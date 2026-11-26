from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsBranchManagerOrManagingDirector, IsManagingDirector
from accounts.models import UserProfile
from operations.models import (
    ApprovedRate,
    AuditEvent,
    CashClose,
    Customer,
    ExceptionUpdate,
    OperationalException,
    PaymentVoucher,
    Receipt,
    SalesInvoice,
    StockMovement,
    SupplierBill,
)
from operations.serializers import (
    ApprovedRateSerializer,
    AuditEventSerializer,
    CashCloseSerializer,
    CreditDecisionSerializer,
    CustomerSerializer,
    ExceptionUpdateCreateSerializer,
    ExceptionUpdateSerializer,
    OperationalExceptionSerializer,
    PaymentVoucherSerializer,
    ReceiptSerializer,
    ReviewDecisionSerializer,
    SalesInvoiceSerializer,
    StockMovementSerializer,
    SupplierBillSerializer,
    current_customer_exposure_usd,
)


def record_audit_event(actor, action, entity_type, entity_id, details=None):
    AuditEvent.objects.create(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        details=details or {},
    )


class HealthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"status": "ok"})


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.select_related("created_by", "credit_approved_by").all()
    serializer_class = CustomerSerializer
    permission_classes = [IsBranchManagerOrManagingDirector]
    http_method_names = ["get", "post", "head", "options"]

    @transaction.atomic
    def perform_create(self, serializer):
        customer = serializer.save(created_by=self.request.user)
        record_audit_event(
            self.request.user,
            "created",
            "customer",
            customer.pk,
            {"customer_code": customer.customer_code},
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="credit-decision",
        permission_classes=[IsManagingDirector],
    )
    @transaction.atomic
    def credit_decision(self, request, pk=None):
        customer = self.get_object()
        customer = Customer.objects.select_for_update().get(pk=customer.pk)
        decision_serializer = CreditDecisionSerializer(data=request.data)
        decision_serializer.is_valid(raise_exception=True)
        decision = decision_serializer.validated_data["decision"]
        if decision == Customer.CreditStatus.APPROVED:
            customer.approved_credit_limit_usd = decision_serializer.validated_data["approved_credit_limit_usd"]
            customer.credit_status = Customer.CreditStatus.APPROVED
            customer.credit_approved_by = request.user
            customer.credit_approved_at = timezone.now()
        else:
            customer.approved_credit_limit_usd = None
            customer.credit_status = Customer.CreditStatus.REJECTED
            customer.credit_approved_by = request.user
            customer.credit_approved_at = None
        customer.save(update_fields=[
            "approved_credit_limit_usd",
            "credit_status",
            "credit_approved_by",
            "credit_approved_at",
        ])
        record_audit_event(
            request.user,
            "credit_decision",
            "customer",
            customer.pk,
            {
                "decision": decision,
                "approved_credit_limit_usd": str(customer.approved_credit_limit_usd)
                if customer.approved_credit_limit_usd is not None
                else None,
            },
        )
        return Response(CustomerSerializer(customer).data)

    @action(detail=True, methods=["get"], url_path="balance")
    def balance(self, request, pk=None):
        customer = self.get_object()
        invoices = SalesInvoice.objects.filter(
            customer=customer,
            sale_type__in=[SalesInvoice.SaleType.CREDIT, SalesInvoice.SaleType.PART_PAID],
        ).prefetch_related("receipts")
        balances = {"USD": Decimal("0"), "ZiG": Decimal("0")}
        overdue_usd = Decimal("0")
        today = timezone.localdate()
        for invoice in invoices:
            allocated = sum((receipt.amount for receipt in invoice.receipts.all()), Decimal("0"))
            balance = invoice.amount - allocated
            balances[invoice.currency] += balance
            if invoice.currency == "USD" and invoice.due_date and (today - invoice.due_date).days > 30:
                overdue_usd += max(balance, Decimal("0"))
        unallocated = Receipt.objects.filter(
            customer=customer,
            invoice__isnull=True,
            source=Receipt.Source.DEBTOR,
        ).values("currency").annotate(total=Sum("amount"))
        unallocated_by_currency = {"USD": Decimal("0"), "ZiG": Decimal("0")}
        for row in unallocated:
            unallocated_by_currency[row["currency"]] = row["total"]
        return Response({
            "customer": str(customer.pk),
            "open_credit_balance": {key: str(value) for key, value in balances.items()},
            "over_30_days_usd": str(overdue_usd),
            "unallocated_debtor_receipts": {key: str(value) for key, value in unallocated_by_currency.items()},
        })


class SalesInvoiceViewSet(viewsets.ModelViewSet):
    queryset = SalesInvoice.objects.select_related("customer", "created_by").all()
    serializer_class = SalesInvoiceSerializer
    permission_classes = [IsBranchManagerOrManagingDirector]
    http_method_names = ["get", "post", "head", "options"]

    @transaction.atomic
    def perform_create(self, serializer):
        sale_type = serializer.validated_data["sale_type"]
        customer = serializer.validated_data.get("customer")
        if sale_type != SalesInvoice.SaleType.CASH:
            customer = Customer.objects.select_for_update().get(pk=customer.pk)
            if customer.credit_status != Customer.CreditStatus.APPROVED:
                raise serializers.ValidationError({"customer": "Credit approval is no longer active."})
            if customer.approved_credit_limit_usd is None:
                raise serializers.ValidationError({"customer": "The approved account has no credit limit."})
            exposure = current_customer_exposure_usd(customer)
            new_exposure = serializer.validated_data["amount"] * serializer.validated_data["usd_per_unit"]
            if exposure + new_exposure > customer.approved_credit_limit_usd:
                raise serializers.ValidationError({
                    "amount": "This sale would exceed the approved customer credit limit."
                })
        invoice = serializer.save(
            customer=customer,
            customer_name=customer.name if customer else serializer.validated_data["customer_name"].strip(),
            created_by=self.request.user,
        )
        record_audit_event(
            self.request.user,
            "created",
            "sales_invoice",
            invoice.pk,
            {
                "invoice_number": invoice.invoice_number,
                "amount": str(invoice.amount),
                "currency": invoice.currency,
                "sale_type": invoice.sale_type,
            },
        )


class ReceiptViewSet(viewsets.ModelViewSet):
    queryset = Receipt.objects.select_related("customer", "invoice", "created_by").all()
    serializer_class = ReceiptSerializer
    permission_classes = [IsBranchManagerOrManagingDirector]
    http_method_names = ["get", "post", "head", "options"]

    @transaction.atomic
    def perform_create(self, serializer):
        invoice = serializer.validated_data.get("invoice")
        if invoice:
            invoice = SalesInvoice.objects.select_for_update().get(pk=invoice.pk)
            allocated = invoice.receipts.aggregate(total=Sum("amount"))["total"] or Decimal("0")
            remaining = invoice.amount - allocated
            if serializer.validated_data["amount"] > remaining:
                raise serializers.ValidationError({
                    "amount": f"Receipt exceeds the invoice's remaining balance of {remaining} {invoice.currency}."
                })
            customer = invoice.customer
            payer = invoice.customer_name
        else:
            customer = serializer.validated_data.get("customer")
            payer = serializer.validated_data["payer"].strip()
        receipt = serializer.save(
            invoice=invoice,
            customer=customer,
            payer=payer,
            created_by=self.request.user,
        )
        record_audit_event(
            self.request.user,
            "created",
            "receipt",
            receipt.pk,
            {
                "receipt_number": receipt.receipt_number,
                "amount": str(receipt.amount),
                "currency": receipt.currency,
                "invoice": str(receipt.invoice_id) if receipt.invoice_id else None,
            },
        )


class SupplierBillViewSet(viewsets.ModelViewSet):
    queryset = SupplierBill.objects.select_related("created_by", "reviewed_by").all()
    serializer_class = SupplierBillSerializer
    permission_classes = [IsBranchManagerOrManagingDirector]
    http_method_names = ["get", "post", "head", "options"]

    @transaction.atomic
    def perform_create(self, serializer):
        bill = serializer.save(created_by=self.request.user)
        record_audit_event(
            self.request.user,
            "created",
            "supplier_bill",
            bill.pk,
            {
                "supplier_invoice_number": bill.supplier_invoice_number,
                "supplier_name": bill.supplier_name,
                "amount": str(bill.amount),
                "currency": bill.currency,
            },
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="review",
        permission_classes=[IsManagingDirector],
    )
    @transaction.atomic
    def review(self, request, pk=None):
        bill = SupplierBill.objects.select_for_update().get(pk=self.get_object().pk)
        if bill.created_by_id == request.user.pk:
            raise PermissionDenied("A different Managing Director must review this supplier bill.")
        if bill.review_status != SupplierBill.ReviewStatus.PENDING:
            raise serializers.ValidationError({"decision": "This supplier bill has already been reviewed."})
        decision_serializer = ReviewDecisionSerializer(data=request.data)
        decision_serializer.is_valid(raise_exception=True)
        decision = decision_serializer.validated_data["decision"]
        if decision == SupplierBill.ReviewStatus.REJECTED and bill.payments.exclude(
            review_status=PaymentVoucher.ReviewStatus.REJECTED
        ).exists():
            raise serializers.ValidationError({
                "decision": "A supplier bill with active settlement vouchers cannot be rejected."
            })
        bill.review_status = decision
        bill.reviewed_by = request.user
        bill.reviewed_at = timezone.now()
        bill.save(update_fields=["review_status", "reviewed_by", "reviewed_at"])
        record_audit_event(
            request.user,
            "supplier_bill_review",
            "supplier_bill",
            bill.pk,
            {"decision": decision},
        )
        return Response(SupplierBillSerializer(bill).data)


class PaymentVoucherViewSet(viewsets.ModelViewSet):
    queryset = PaymentVoucher.objects.select_related("supplier_bill", "created_by", "reviewed_by").all()
    serializer_class = PaymentVoucherSerializer
    permission_classes = [IsBranchManagerOrManagingDirector]
    http_method_names = ["get", "post", "head", "options"]

    @transaction.atomic
    def perform_create(self, serializer):
        supplier_bill = serializer.validated_data.get("supplier_bill")
        if supplier_bill:
            supplier_bill = SupplierBill.objects.select_for_update().get(pk=supplier_bill.pk)
            if supplier_bill.review_status != SupplierBill.ReviewStatus.APPROVED:
                raise serializers.ValidationError({"supplier_bill": "Only MD-approved supplier bills can be settled."})
            reserved = supplier_bill.payments.exclude(
                review_status=PaymentVoucher.ReviewStatus.REJECTED
            ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
            if serializer.validated_data["amount"] + reserved > supplier_bill.amount:
                remaining = supplier_bill.amount - reserved
                raise serializers.ValidationError({
                    "amount": f"Settlement exceeds the supplier bill's remaining balance of {remaining} {supplier_bill.currency}."
                })
        payment = serializer.save(supplier_bill=supplier_bill, created_by=self.request.user)
        record_audit_event(
            self.request.user,
            "created",
            "payment_voucher",
            payment.pk,
            {
                "voucher_number": payment.voucher_number,
                "amount": str(payment.amount),
                "currency": payment.currency,
                "supplier_bill": str(payment.supplier_bill_id) if payment.supplier_bill_id else None,
            },
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="review",
        permission_classes=[IsManagingDirector],
    )
    @transaction.atomic
    def review(self, request, pk=None):
        payment = PaymentVoucher.objects.select_for_update().get(pk=self.get_object().pk)
        if payment.created_by_id == request.user.pk:
            raise PermissionDenied("A different Managing Director must review this payment voucher.")
        if payment.review_status != PaymentVoucher.ReviewStatus.PENDING:
            raise serializers.ValidationError({"decision": "This payment voucher has already been reviewed."})
        decision_serializer = ReviewDecisionSerializer(data=request.data)
        decision_serializer.is_valid(raise_exception=True)
        decision = decision_serializer.validated_data["decision"]
        payment.review_status = decision
        payment.reviewed_by = request.user
        payment.reviewed_at = timezone.now()
        payment.save(update_fields=["review_status", "reviewed_by", "reviewed_at"])
        record_audit_event(
            request.user,
            "payment_voucher_review",
            "payment_voucher",
            payment.pk,
            {"decision": decision},
        )
        return Response(PaymentVoucherSerializer(payment).data)


class CashCloseViewSet(viewsets.ModelViewSet):
    queryset = CashClose.objects.select_related("created_by").all()
    serializer_class = CashCloseSerializer
    permission_classes = [IsBranchManagerOrManagingDirector]
    http_method_names = ["get", "post", "head", "options"]

    @transaction.atomic
    def perform_create(self, serializer):
        data = serializer.validated_data
        business_date = data["business_date"]
        if CashClose.objects.filter(business_date=business_date).exists():
            raise serializers.ValidationError({"business_date": "A cash close already exists for this date."})

        def total_receipts(currency, destination):
            return Receipt.objects.filter(
                receipt_date=business_date,
                method=Receipt.Method.CASH,
                received_into=destination,
                currency=currency,
            ).aggregate(total=Sum("amount"))["total"] or Decimal("0")

        def total_payments(currency):
            return PaymentVoucher.objects.filter(
                paid_date=business_date,
                method=PaymentVoucher.Method.CASH,
                paid_from__iexact=f"Till {currency}",
                currency=currency,
                review_status=PaymentVoucher.ReviewStatus.APPROVED,
            ).aggregate(total=Sum("amount"))["total"] or Decimal("0")

        receipt_usd = total_receipts("USD", Receipt.Destination.TILL_USD)
        receipt_zig = total_receipts("ZiG", Receipt.Destination.TILL_ZIG)
        payment_usd = total_payments("USD")
        payment_zig = total_payments("ZiG")
        expected_usd = data["opening_usd"] + receipt_usd + data["withdrawals_to_till_usd"] - payment_usd - data["deposits_to_bank_usd"]
        expected_zig = data["opening_zig"] + receipt_zig + data["withdrawals_to_till_zig"] - payment_zig - data["deposits_to_bank_zig"]
        variance_usd = data.get("actual_usd") - expected_usd if data.get("actual_usd") is not None else None
        variance_zig = data.get("actual_zig") - expected_zig if data.get("actual_zig") is not None else None
        status_usd = cash_close_status(variance_usd)
        status_zig = cash_close_status(variance_zig)
        if CashClose.Status.VARIANCE in {status_usd, status_zig} and not data.get("exception_reference", "").strip():
            raise serializers.ValidationError({"exception_reference": "Record an exception reference before saving a cash variance."})

        cash_close = serializer.save(
            cash_receipts_usd=receipt_usd,
            cash_payments_usd=payment_usd,
            expected_usd=expected_usd,
            variance_usd=variance_usd,
            status_usd=status_usd,
            cash_receipts_zig=receipt_zig,
            cash_payments_zig=payment_zig,
            expected_zig=expected_zig,
            variance_zig=variance_zig,
            status_zig=status_zig,
            created_by=self.request.user,
        )
        record_audit_event(
            self.request.user,
            "created",
            "cash_close",
            cash_close.pk,
            {
                "business_date": business_date.isoformat(),
                "status_usd": status_usd,
                "status_zig": status_zig,
            },
        )


def cash_close_status(variance):
    if variance is None:
        return CashClose.Status.COUNT_MISSING
    if abs(variance) >= Decimal("0.01"):
        return CashClose.Status.VARIANCE
    return CashClose.Status.OK


class StockMovementViewSet(viewsets.ModelViewSet):
    queryset = StockMovement.objects.select_related("created_by").all()
    serializer_class = StockMovementSerializer
    permission_classes = [IsBranchManagerOrManagingDirector]
    http_method_names = ["get", "post", "head", "options"]

    @transaction.atomic
    def perform_create(self, serializer):
        movement = serializer.save(created_by=self.request.user)
        record_audit_event(
            self.request.user,
            "created",
            "stock_movement",
            movement.pk,
            {
                "item_code": movement.item_code,
                "location": movement.location,
                "quantity_in": str(movement.quantity_in),
                "quantity_out": str(movement.quantity_out),
                "source_reference": movement.source_reference,
            },
        )


class OperationalExceptionViewSet(viewsets.ModelViewSet):
    queryset = OperationalException.objects.select_related("created_by").prefetch_related("follow_ups__updated_by").all()
    serializer_class = OperationalExceptionSerializer
    permission_classes = [IsBranchManagerOrManagingDirector]
    http_method_names = ["get", "post", "head", "options"]

    @transaction.atomic
    def perform_create(self, serializer):
        exception = serializer.save(created_by=self.request.user)
        record_audit_event(
            self.request.user,
            "created",
            "operational_exception",
            exception.pk,
            {"exception_id": exception.exception_id, "area": exception.area},
        )

    @action(detail=True, methods=["post"], url_path="updates")
    @transaction.atomic
    def updates(self, request, pk=None):
        exception = OperationalException.objects.select_for_update().get(pk=self.get_object().pk)
        update_serializer = ExceptionUpdateCreateSerializer(data=request.data)
        update_serializer.is_valid(raise_exception=True)
        values = update_serializer.validated_data
        existing_update = ExceptionUpdate.objects.filter(submission_id=values["submission_id"]).first()
        if existing_update:
            if (
                existing_update.exception_id != exception.pk
                or existing_update.status != values["status"]
                or existing_update.action != values["action"]
                or existing_update.closed_date != values.get("closed_date")
            ):
                raise serializers.ValidationError({"submission_id": "This submission ID was already used for a different update."})
            return Response(ExceptionUpdateSerializer(existing_update).data, status=200)
        if exception.status == OperationalException.Status.CLOSED:
            raise serializers.ValidationError({"status": "A closed exception cannot be updated."})
        if values["status"] in {OperationalException.Status.AWAITING_MD, OperationalException.Status.CLOSED}:
            if request.user.profile.role != UserProfile.Role.MANAGING_DIRECTOR:
                raise PermissionDenied("A Managing Director must set this exception status.")
        closed_date = values.get("closed_date")
        if closed_date and closed_date < exception.raised_date:
            raise serializers.ValidationError({"closed_date": "Closed date cannot be before the raised date."})
        exception.status = values["status"]
        exception.closed_date = closed_date
        exception.save(update_fields=["status", "closed_date"])
        update = ExceptionUpdate.objects.create(
            submission_id=values["submission_id"],
            exception=exception,
            status=values["status"],
            action=values["action"],
            closed_date=closed_date,
            updated_by=request.user,
        )
        record_audit_event(
            request.user,
            "exception_update",
            "operational_exception",
            exception.pk,
            {"status": update.status, "action": update.action, "closed_date": update.closed_date.isoformat() if update.closed_date else None},
        )
        return Response(ExceptionUpdateSerializer(update).data, status=201)


class ApprovedRateViewSet(viewsets.ModelViewSet):
    queryset = ApprovedRate.objects.select_related("approved_by").all()
    serializer_class = ApprovedRateSerializer
    http_method_names = ["get", "post", "head", "options"]

    def get_permissions(self):
        permission_class = IsManagingDirector if self.action == "create" else IsBranchManagerOrManagingDirector
        return [permission_class()]

    @transaction.atomic
    def perform_create(self, serializer):
        effective_date = serializer.validated_data["effective_date"]
        latest_rate = ApprovedRate.objects.select_for_update().filter(
            currency=serializer.validated_data["currency"],
        ).order_by("-effective_date").first()
        if latest_rate and effective_date <= latest_rate.effective_date:
            raise serializers.ValidationError({"effective_date": "New rates must be added after the latest approved rate."})
        if latest_rate and latest_rate.effective_to and effective_date <= latest_rate.effective_to:
            raise serializers.ValidationError({"effective_date": "New rate period overlaps the latest approved rate."})
        if latest_rate and latest_rate.effective_to is None:
            latest_rate.effective_to = effective_date - timedelta(days=1)
            latest_rate.save(update_fields=["effective_to"])
            record_audit_event(
                self.request.user,
                "closed_rate_period",
                "exchange_rate",
                latest_rate.pk,
                {"effective_to": latest_rate.effective_to.isoformat()},
            )
        rate = serializer.save(approved_by=self.request.user)
        record_audit_event(
            self.request.user,
            "approved",
            "exchange_rate",
            rate.pk,
            {
                "currency": rate.currency,
                "effective_date": rate.effective_date.isoformat(),
                "usd_per_unit": str(rate.usd_per_unit),
            },
        )


class AuditEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditEvent.objects.select_related("actor").all()
    serializer_class = AuditEventSerializer
    permission_classes = [IsManagingDirector]

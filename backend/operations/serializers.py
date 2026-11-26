import uuid
from decimal import Decimal

from django.db.models import Q, Sum
from rest_framework import serializers

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


def snapshot_usd_rate(currency, transaction_date):
    if currency == "USD":
        return Decimal("1")
    rate = ApprovedRate.objects.filter(
        currency=currency,
        effective_date__lte=transaction_date,
    ).filter(
        Q(effective_to__isnull=True) | Q(effective_to__gte=transaction_date)
    ).order_by("-effective_date").first()
    if not rate:
        raise serializers.ValidationError({
            "currency": f"No MD-approved exchange rate exists for this date ({transaction_date})."
        })
    return rate.usd_per_unit


class ApprovedRateSerializer(serializers.ModelSerializer):
    approved_by_username = serializers.CharField(source="approved_by.get_username", read_only=True)

    class Meta:
        model = ApprovedRate
        fields = [
            "id",
            "currency",
            "effective_date",
            "effective_to",
            "usd_per_unit",
            "source_reference",
            "approved_by",
            "approved_by_username",
            "created_at",
        ]
        read_only_fields = ["id", "effective_to", "approved_by", "approved_by_username", "created_at"]
        extra_kwargs = {"source_reference": {"required": True, "allow_blank": False}}


class AuditEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.SerializerMethodField()

    class Meta:
        model = AuditEvent
        fields = ["id", "actor", "actor_username", "action", "entity_type", "entity_id", "details", "occurred_at"]
        read_only_fields = fields

    def get_actor_username(self, obj):
        return obj.actor.get_username() if obj.actor else None


class CustomerSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.get_username", read_only=True)
    credit_approved_by_username = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            "id",
            "customer_code",
            "name",
            "proposed_credit_limit_usd",
            "approved_credit_limit_usd",
            "terms_days",
            "credit_status",
            "credit_approved_by",
            "credit_approved_by_username",
            "credit_approved_at",
            "follow_up",
            "created_by",
            "created_by_username",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "approved_credit_limit_usd",
            "credit_status",
            "credit_approved_by",
            "credit_approved_by_username",
            "credit_approved_at",
            "created_by",
            "created_by_username",
            "created_at",
        ]
        extra_kwargs = {
            "proposed_credit_limit_usd": {"required": False, "allow_null": True},
            "terms_days": {"min_value": 0, "max_value": 365},
        }

    def get_credit_approved_by_username(self, obj):
        return obj.credit_approved_by.get_username() if obj.credit_approved_by else None


class SalesInvoiceSerializer(serializers.ModelSerializer):
    customer_code = serializers.CharField(source="customer.customer_code", read_only=True)
    usd_amount = serializers.DecimalField(source="amount_usd", max_digits=32, decimal_places=10, read_only=True)
    created_by_username = serializers.CharField(source="created_by.get_username", read_only=True)

    class Meta:
        model = SalesInvoice
        fields = [
            "id",
            "invoice_number",
            "sale_date",
            "customer",
            "customer_code",
            "customer_name",
            "description",
            "amount",
            "currency",
            "usd_per_unit",
            "usd_amount",
            "sale_type",
            "due_date",
            "created_by",
            "created_by_username",
            "created_at",
        ]
        read_only_fields = ["id", "usd_per_unit", "usd_amount", "created_by", "created_by_username", "created_at"]
        extra_kwargs = {
            "customer": {"required": False, "allow_null": True},
            "customer_name": {"required": False, "allow_blank": True},
            "due_date": {"required": False, "allow_null": True},
        }

    def validate(self, attrs):
        sale_type = attrs.get("sale_type")
        sale_date = attrs.get("sale_date")
        due_date = attrs.get("due_date")
        customer = attrs.get("customer")
        currency = attrs.get("currency")
        if sale_type in {SalesInvoice.SaleType.CREDIT, SalesInvoice.SaleType.PART_PAID}:
            if not customer:
                raise serializers.ValidationError({"customer": "A customer account is required for credit sales."})
            if customer.credit_status != Customer.CreditStatus.APPROVED:
                raise serializers.ValidationError({"customer": "Credit sales require an MD-approved customer account."})
            if not due_date:
                raise serializers.ValidationError({"due_date": "A due date is required for credit sales."})
        if due_date and sale_date and due_date < sale_date:
            raise serializers.ValidationError({"due_date": "Due date cannot be before the sale date."})
        if customer:
            attrs["customer_name"] = customer.name
        elif not attrs.get("customer_name", "").strip():
            raise serializers.ValidationError({"customer_name": "Enter a payer name for an unregistered customer."})

        attrs["usd_per_unit"] = snapshot_usd_rate(currency, sale_date)
        return attrs


class ReceiptSerializer(serializers.ModelSerializer):
    customer_code = serializers.CharField(source="customer.customer_code", read_only=True)
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True)
    usd_amount = serializers.DecimalField(source="amount_usd", max_digits=32, decimal_places=10, read_only=True)
    created_by_username = serializers.CharField(source="created_by.get_username", read_only=True)

    class Meta:
        model = Receipt
        fields = [
            "id",
            "receipt_number",
            "receipt_date",
            "source",
            "customer",
            "customer_code",
            "payer",
            "invoice",
            "invoice_number",
            "method",
            "received_into",
            "currency",
            "amount",
            "usd_per_unit",
            "usd_amount",
            "reference",
            "received_by",
            "notes",
            "created_by",
            "created_by_username",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "customer_code",
            "invoice_number",
            "usd_per_unit",
            "usd_amount",
            "created_by",
            "created_by_username",
            "created_at",
        ]
        extra_kwargs = {
            "customer": {"required": False, "allow_null": True},
            "invoice": {"required": False, "allow_null": True},
            "reference": {"required": False, "allow_blank": True},
            "notes": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        invoice = attrs.get("invoice")
        customer = attrs.get("customer")
        source = attrs.get("source")
        currency = attrs.get("currency")
        receipt_date = attrs.get("receipt_date")
        if invoice:
            allowed_sources = {
                Receipt.Source.SAME_DAY,
                Receipt.Source.DEBTOR,
                Receipt.Source.DEPOSIT,
            }
            if source not in allowed_sources:
                raise serializers.ValidationError({"invoice": "This receipt source cannot be allocated to an invoice."})
            if invoice.currency != currency:
                raise serializers.ValidationError({"currency": "Receipt currency must match the invoice currency."})
            if customer and invoice.customer_id != customer.id:
                raise serializers.ValidationError({"customer": "The selected customer does not own this invoice."})
            attrs["customer"] = invoice.customer
            attrs["payer"] = invoice.customer_name

        attrs["usd_per_unit"] = snapshot_usd_rate(currency, receipt_date)

        if customer and not invoice and attrs.get("payer", "").strip() != customer.name:
            raise serializers.ValidationError({"payer": "Payer name must match the selected customer account."})
        return attrs


class SupplierBillSerializer(serializers.ModelSerializer):
    reviewed_by_username = serializers.CharField(source="reviewed_by.get_username", read_only=True)
    created_by_username = serializers.CharField(source="created_by.get_username", read_only=True)
    usd_amount = serializers.DecimalField(source="amount_usd", max_digits=32, decimal_places=10, read_only=True)

    class Meta:
        model = SupplierBill
        fields = [
            "id",
            "supplier_invoice_number",
            "supplier_name",
            "supplier_code",
            "bill_date",
            "bill_type",
            "category",
            "description",
            "source_reference",
            "amount",
            "currency",
            "usd_per_unit",
            "usd_amount",
            "due_date",
            "entered_by",
            "notes",
            "review_status",
            "reviewed_by",
            "reviewed_by_username",
            "reviewed_at",
            "created_by",
            "created_by_username",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "usd_per_unit",
            "usd_amount",
            "review_status",
            "reviewed_by",
            "reviewed_by_username",
            "reviewed_at",
            "created_by",
            "created_by_username",
            "created_at",
        ]
        extra_kwargs = {
            "supplier_code": {"required": False, "allow_blank": True},
            "category": {"required": False, "allow_blank": True},
            "due_date": {"required": False, "allow_null": True},
            "notes": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        bill_date = attrs.get("bill_date")
        due_date = attrs.get("due_date")
        if due_date and bill_date and due_date < bill_date:
            raise serializers.ValidationError({"due_date": "Due date cannot be before the bill date."})
        attrs["usd_per_unit"] = snapshot_usd_rate(attrs.get("currency"), bill_date)
        return attrs


class PaymentVoucherSerializer(serializers.ModelSerializer):
    supplier_invoice_number = serializers.CharField(source="supplier_bill.supplier_invoice_number", read_only=True)
    reviewed_by_username = serializers.CharField(source="reviewed_by.get_username", read_only=True)
    created_by_username = serializers.CharField(source="created_by.get_username", read_only=True)
    usd_amount = serializers.DecimalField(source="amount_usd", max_digits=32, decimal_places=10, read_only=True)

    class Meta:
        model = PaymentVoucher
        fields = [
            "id",
            "voucher_number",
            "paid_date",
            "payee",
            "spend_class",
            "category",
            "purpose",
            "source_reference",
            "paid_from",
            "method",
            "amount",
            "currency",
            "usd_per_unit",
            "usd_amount",
            "supplier_bill",
            "supplier_invoice_number",
            "paid_by",
            "notes",
            "review_status",
            "reviewed_by",
            "reviewed_by_username",
            "reviewed_at",
            "created_by",
            "created_by_username",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "usd_per_unit",
            "usd_amount",
            "supplier_invoice_number",
            "review_status",
            "reviewed_by",
            "reviewed_by_username",
            "reviewed_at",
            "created_by",
            "created_by_username",
            "created_at",
        ]
        extra_kwargs = {
            "category": {"required": False, "allow_blank": True},
            "supplier_bill": {"required": False, "allow_null": True},
            "notes": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        paid_date = attrs.get("paid_date")
        currency = attrs.get("currency")
        supplier_bill = attrs.get("supplier_bill")
        spend_class = attrs.get("spend_class")
        if spend_class == PaymentVoucher.SpendClass.SUPPLIER:
            if not supplier_bill:
                raise serializers.ValidationError({"supplier_bill": "Select the approved supplier bill being settled."})
            if supplier_bill.review_status != SupplierBill.ReviewStatus.APPROVED:
                raise serializers.ValidationError({"supplier_bill": "Only MD-approved supplier bills can be settled."})
            if supplier_bill.currency != currency:
                raise serializers.ValidationError({"currency": "Settlement currency must match the supplier bill."})
            attrs["payee"] = supplier_bill.supplier_name
            attrs["source_reference"] = supplier_bill.supplier_invoice_number
        elif supplier_bill:
            raise serializers.ValidationError({"supplier_bill": "Link a supplier bill only for a supplier settlement."})
        attrs["usd_per_unit"] = snapshot_usd_rate(currency, paid_date)
        return attrs


class CashCloseSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.get_username", read_only=True)

    class Meta:
        model = CashClose
        fields = [
            "id",
            "submission_id",
            "business_date",
            "opening_usd",
            "withdrawals_to_till_usd",
            "cash_receipts_usd",
            "cash_payments_usd",
            "deposits_to_bank_usd",
            "expected_usd",
            "actual_usd",
            "variance_usd",
            "status_usd",
            "opening_zig",
            "withdrawals_to_till_zig",
            "cash_receipts_zig",
            "cash_payments_zig",
            "deposits_to_bank_zig",
            "expected_zig",
            "actual_zig",
            "variance_zig",
            "status_zig",
            "prepared_by",
            "witness",
            "exception_reference",
            "created_by",
            "created_by_username",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "cash_receipts_usd",
            "cash_payments_usd",
            "expected_usd",
            "variance_usd",
            "status_usd",
            "cash_receipts_zig",
            "cash_payments_zig",
            "expected_zig",
            "variance_zig",
            "status_zig",
            "created_by",
            "created_by_username",
            "created_at",
        ]
        extra_kwargs = {
            "actual_usd": {"required": False, "allow_null": True},
            "actual_zig": {"required": False, "allow_null": True},
            "exception_reference": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        for field in ("opening_usd", "withdrawals_to_till_usd", "deposits_to_bank_usd", "opening_zig", "withdrawals_to_till_zig", "deposits_to_bank_zig"):
            if attrs.get(field, Decimal("0")) < 0:
                raise serializers.ValidationError({field: "Amount cannot be negative."})
        return attrs


class StockMovementSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.get_username", read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "submission_id",
            "movement_date",
            "item_code",
            "description",
            "location",
            "movement_type",
            "source_reference",
            "quantity_in",
            "quantity_out",
            "unit_cost_usd",
            "entered_by",
            "checked_by",
            "notes",
            "created_by",
            "created_by_username",
            "created_at",
        ]
        read_only_fields = ["id", "created_by", "created_by_username", "created_at"]
        extra_kwargs = {
            "unit_cost_usd": {"required": False, "allow_null": True},
            "checked_by": {"required": False, "allow_blank": True},
            "notes": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        quantity_in = attrs.get("quantity_in", Decimal("0"))
        quantity_out = attrs.get("quantity_out", Decimal("0"))
        if (quantity_in > 0) == (quantity_out > 0):
            raise serializers.ValidationError("Enter exactly one positive quantity: quantity in or quantity out.")
        if attrs.get("movement_type") == StockMovement.MovementType.ADJUSTMENT and not attrs.get("checked_by", "").strip():
            raise serializers.ValidationError({"checked_by": "An approver/checker must be recorded for an adjustment."})
        return attrs


class ExceptionUpdateSerializer(serializers.ModelSerializer):
    reviewer_username = serializers.CharField(source="updated_by.get_username", read_only=True)

    class Meta:
        model = ExceptionUpdate
        fields = ["id", "submission_id", "status", "action", "closed_date", "reviewer_username", "created_at"]
        read_only_fields = ["id", "submission_id", "status", "action", "closed_date", "reviewer_username", "created_at"]


class ExceptionUpdateCreateSerializer(serializers.Serializer):
    submission_id = serializers.UUIDField(required=False, default=uuid.uuid4)
    status = serializers.ChoiceField(choices=OperationalException.Status.choices)
    action = serializers.CharField(max_length=240)
    closed_date = serializers.DateField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs["status"] == OperationalException.Status.CLOSED and not attrs.get("closed_date"):
            raise serializers.ValidationError({"closed_date": "Closed date is required when closing an exception."})
        if attrs["status"] != OperationalException.Status.CLOSED and attrs.get("closed_date"):
            raise serializers.ValidationError({"closed_date": "Closed date is only valid when the exception is closed."})
        return attrs


class OperationalExceptionSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.get_username", read_only=True)
    updates = ExceptionUpdateSerializer(source="follow_ups", many=True, read_only=True)

    class Meta:
        model = OperationalException
        fields = [
            "id",
            "submission_id",
            "exception_id",
            "raised_date",
            "area",
            "source_reference",
            "issue",
            "amount",
            "currency",
            "owner",
            "due_date",
            "status",
            "closed_date",
            "updates",
            "created_by",
            "created_by_username",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "closed_date",
            "updates",
            "created_by",
            "created_by_username",
            "created_at",
        ]
        extra_kwargs = {
            "amount": {"required": False, "allow_null": True},
            "currency": {"required": False, "allow_null": True, "allow_blank": True},
        }

    def validate(self, attrs):
        amount = attrs.get("amount")
        currency = attrs.get("currency")
        if (amount is None) != (currency is None):
            raise serializers.ValidationError({"amount": "Amount and currency must either both be provided or both be blank."})
        if attrs.get("due_date") and attrs.get("raised_date") and attrs["due_date"] < attrs["raised_date"]:
            raise serializers.ValidationError({"due_date": "Due date cannot be before the raised date."})
        return attrs


class ReviewDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=[PaymentVoucher.ReviewStatus.APPROVED, PaymentVoucher.ReviewStatus.REJECTED])


class CreditDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=[Customer.CreditStatus.APPROVED, Customer.CreditStatus.REJECTED])
    approved_credit_limit_usd = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0"), required=False)

    def validate(self, attrs):
        if attrs["decision"] == Customer.CreditStatus.APPROVED and "approved_credit_limit_usd" not in attrs:
            raise serializers.ValidationError({"approved_credit_limit_usd": "Enter the approved USD credit limit."})
        if attrs["decision"] == Customer.CreditStatus.REJECTED and "approved_credit_limit_usd" in attrs:
            raise serializers.ValidationError({"approved_credit_limit_usd": "Do not enter an approved limit when rejecting credit."})
        return attrs


def current_customer_exposure_usd(customer):
    exposure = Decimal("0")
    invoices = SalesInvoice.objects.filter(
        customer=customer,
        sale_type__in=[SalesInvoice.SaleType.CREDIT, SalesInvoice.SaleType.PART_PAID],
    ).prefetch_related("receipts")
    for invoice in invoices:
        receipt_amount_usd = sum(
            (receipt.amount * receipt.usd_per_unit for receipt in invoice.receipts.all()),
            Decimal("0"),
        )
        exposure += max(invoice.amount_usd - receipt_amount_usd, Decimal("0"))
    return exposure


def sum_receipts_for_invoice(invoice):
    return Receipt.objects.filter(invoice=invoice).aggregate(total=Sum("amount"))["total"] or Decimal("0")

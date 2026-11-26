from datetime import date

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import UserProfile
from operations.models import (
    ApprovedRate,
    AuditEvent,
    CashClose,
    Customer,
    ExceptionUpdate,
    PaymentVoucher,
    Receipt,
    SalesInvoice,
    StockMovement,
    SupplierBill,
)
from operations.serializers import snapshot_usd_rate


class LinkedFinanceApiTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.branch_manager = user_model.objects.create_user(username="branch", password="test-password")
        self.branch_manager.profile.role = UserProfile.Role.BRANCH_MANAGER
        self.branch_manager.profile.save()
        self.managing_director = user_model.objects.create_user(username="director", password="test-password")
        self.managing_director.profile.role = UserProfile.Role.MANAGING_DIRECTOR
        self.managing_director.profile.save()
        self.client.force_authenticate(self.branch_manager)

    def test_jwt_login_exposes_server_assigned_role(self):
        response = self.client.post(
            "/api/auth/token/",
            {"username": "branch", "password": "test-password"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        refresh_response = self.client.post(
            "/api/auth/token/refresh/",
            {"refresh": response.data["refresh"]},
            format="json",
        )
        self.assertEqual(refresh_response.status_code, 200, refresh_response.data)
        self.assertIn("access", refresh_response.data)
        self.assertIn("refresh", refresh_response.data)
        reused_refresh = self.client.post(
            "/api/auth/token/refresh/",
            {"refresh": response.data["refresh"]},
            format="json",
        )
        self.assertEqual(reused_refresh.status_code, 401)
        self.client.force_authenticate(user=None)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh_response.data['access']}")
        current_user = self.client.get("/api/auth/me/")
        self.assertEqual(current_user.status_code, 200)
        self.assertEqual(current_user.data["role"], UserProfile.Role.BRANCH_MANAGER)
        logout = self.client.post(
            "/api/auth/logout/",
            {"refresh": refresh_response.data["refresh"]},
            format="json",
        )
        self.assertEqual(logout.status_code, 204)
        after_logout = self.client.post(
            "/api/auth/token/refresh/",
            {"refresh": refresh_response.data["refresh"]},
            format="json",
        )
        self.assertEqual(after_logout.status_code, 401)

    def create_customer(self, code="C-001"):
        response = self.client.post(
            reverse("customer-list"),
            {
                "customer_code": code,
                "name": "Test Customer",
                "proposed_credit_limit_usd": "250.00",
                "terms_days": 30,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def approve_customer(self, customer_id, amount="250.00"):
        self.client.force_authenticate(self.managing_director)
        response = self.client.post(
            f"/api/customers/{customer_id}/credit-decision/",
            {"decision": "approved", "approved_credit_limit_usd": amount},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.client.force_authenticate(self.branch_manager)

    def create_credit_invoice(self, customer_id, number="INV-001", amount="100.00"):
        return self.client.post(
            reverse("sales-list"),
            {
                "invoice_number": number,
                "sale_date": "2026-09-01",
                "customer": customer_id,
                "customer_name": "Ignored when account selected",
                "description": "Workshop service",
                "amount": amount,
                "currency": "USD",
                "sale_type": SalesInvoice.SaleType.CREDIT,
                "due_date": "2026-10-01",
            },
            format="json",
        )

    def test_credit_approval_is_md_only_and_credit_sales_require_approval(self):
        customer = self.create_customer()
        self.assertEqual(customer["credit_status"], Customer.CreditStatus.PENDING)

        forbidden = self.client.post(
            f"/api/customers/{customer['id']}/credit-decision/",
            {"decision": "approved", "approved_credit_limit_usd": "250.00"},
            format="json",
        )
        self.assertEqual(forbidden.status_code, 403)

        not_approved = self.create_credit_invoice(customer["id"])
        self.assertEqual(not_approved.status_code, 400)
        self.assertIn("MD-approved", str(not_approved.data))

        self.approve_customer(customer["id"])
        created = self.create_credit_invoice(customer["id"])
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(str(created.data["customer"]), customer["id"])
        self.assertEqual(created.data["usd_amount"], "100.0000000000")

    def test_partial_receipts_reduce_balance_and_overallocation_is_rejected(self):
        customer = self.create_customer()
        self.approve_customer(customer["id"])
        invoice = self.create_credit_invoice(customer["id"])
        self.assertEqual(invoice.status_code, 201, invoice.data)
        receipt_data = {
            "receipt_number": "RCT-001",
            "receipt_date": "2026-11-25",
            "source": Receipt.Source.DEBTOR,
            "customer": customer["id"],
            "payer": "Test Customer",
            "invoice": invoice.data["id"],
            "method": Receipt.Method.CASH,
            "received_into": Receipt.Destination.TILL_USD,
            "currency": "USD",
            "amount": "40.00",
            "received_by": "Branch cashier",
        }
        receipt = self.client.post(reverse("receipt-list"), receipt_data, format="json")
        self.assertEqual(receipt.status_code, 201, receipt.data)
        self.assertEqual(receipt.data["invoice_number"], "INV-001")

        overpayment = {**receipt_data, "receipt_number": "RCT-002", "amount": "60.01"}
        rejected = self.client.post(reverse("receipt-list"), overpayment, format="json")
        self.assertEqual(rejected.status_code, 400)
        self.assertIn("remaining balance", str(rejected.data))
        self.assertEqual(Receipt.objects.filter(invoice_id=invoice.data["id"]).count(), 1)

        balance = self.client.get(f"/api/customers/{customer['id']}/balance/")
        self.assertEqual(balance.status_code, 200)
        self.assertEqual(balance.data["open_credit_balance"]["USD"], "60.00")
        self.assertEqual(balance.data["over_30_days_usd"], "60.00")

    def test_credit_limit_is_enforced_and_audit_records_are_read_only(self):
        customer = self.create_customer()
        self.approve_customer(customer["id"], "120.00")
        first = self.create_credit_invoice(customer["id"], "INV-001", "100.00")
        self.assertEqual(first.status_code, 201, first.data)
        too_large = self.create_credit_invoice(customer["id"], "INV-002", "30.00")
        self.assertEqual(too_large.status_code, 400)
        self.assertIn("credit limit", str(too_large.data))
        self.assertEqual(AuditEvent.objects.filter(entity_type="sales_invoice").count(), 1)

        self.client.force_authenticate(self.managing_director)
        events = self.client.get(reverse("audit-event-list"))
        self.assertEqual(events.status_code, 200)
        event_id = events.data["results"][0]["id"]
        delete_response = self.client.delete(f"/api/audit-events/{event_id}/")
        self.assertEqual(delete_response.status_code, 405)

    def test_ziG_transactions_require_an_md_approved_rate(self):
        customer = self.create_customer()
        self.approve_customer(customer["id"])
        ziG_invoice_data = {
            "invoice_number": "INV-ZIG-001",
            "sale_date": "2026-11-25",
            "customer": customer["id"],
            "customer_name": "Test Customer",
            "description": "Parts",
            "amount": "100000.00",
            "currency": "ZiG",
            "sale_type": SalesInvoice.SaleType.CREDIT,
            "due_date": "2026-12-25",
        }
        missing_rate = self.client.post(reverse("sales-list"), ziG_invoice_data, format="json")
        self.assertEqual(missing_rate.status_code, 400)

        self.client.force_authenticate(self.managing_director)
        rate = self.client.post(
            reverse("approved-rate-list"),
            {
                "currency": "ZiG",
                "effective_date": "2026-11-01",
                "usd_per_unit": "0.00100000",
                "source_reference": "MD-RATE-001",
            },
            format="json",
        )
        self.assertEqual(rate.status_code, 201, rate.data)
        self.client.force_authenticate(self.branch_manager)
        created = self.client.post(reverse("sales-list"), ziG_invoice_data, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["usd_amount"], "100.0000000000")
        self.assertEqual(created.data["usd_per_unit"], "0.00100000")

    def create_supplier_bill(self, number="SUP-001", amount="100.00"):
        return self.client.post(
            reverse("supplier-bill-list"),
            {
                "supplier_invoice_number": number,
                "supplier_name": "Test Supplier",
                "supplier_code": "S-001",
                "bill_date": "2026-11-25",
                "bill_type": SupplierBill.BillType.INVENTORY,
                "category": "Parts",
                "description": "Workshop parts",
                "source_reference": "GRN-001",
                "amount": amount,
                "currency": "USD",
                "due_date": "2026-12-25",
                "entered_by": "Branch Clerk",
                "notes": "",
            },
            format="json",
        )

    def create_supplier_settlement(self, bill_id, number="PAY-001", amount="100.00"):
        return self.client.post(
            reverse("payment-list"),
            {
                "voucher_number": number,
                "paid_date": "2026-11-25",
                "payee": "Untrusted payee is replaced",
                "spend_class": PaymentVoucher.SpendClass.SUPPLIER,
                "category": "",
                "purpose": "Settle supplier bill",
                "source_reference": "Untrusted reference is replaced",
                "paid_from": "Bank USD",
                "method": "Bank transfer",
                "amount": amount,
                "currency": "USD",
                "supplier_bill": bill_id,
                "paid_by": "Branch Clerk",
                "notes": "",
            },
            format="json",
        )

    def test_supplier_bill_and_settlement_require_separate_md_review(self):
        bill = self.create_supplier_bill()
        self.assertEqual(bill.status_code, 201, bill.data)
        self.assertEqual(bill.data["review_status"], SupplierBill.ReviewStatus.PENDING)

        forbidden = self.client.post(
            f"/api/supplier-bills/{bill.data['id']}/review/",
            {"decision": "approved"},
            format="json",
        )
        self.assertEqual(forbidden.status_code, 403)

        self.client.force_authenticate(self.managing_director)
        approved_bill = self.client.post(
            f"/api/supplier-bills/{bill.data['id']}/review/",
            {"decision": "approved"},
            format="json",
        )
        self.assertEqual(approved_bill.status_code, 200, approved_bill.data)
        self.assertEqual(approved_bill.data["review_status"], SupplierBill.ReviewStatus.APPROVED)
        self.client.force_authenticate(self.branch_manager)

        payment = self.create_supplier_settlement(bill.data["id"])
        self.assertEqual(payment.status_code, 201, payment.data)
        self.assertEqual(payment.data["payee"], "Test Supplier")
        self.assertEqual(payment.data["supplier_invoice_number"], "SUP-001")
        self.assertEqual(payment.data["review_status"], PaymentVoucher.ReviewStatus.PENDING)

        overpayment = self.create_supplier_settlement(bill.data["id"], "PAY-002", "0.01")
        self.assertEqual(overpayment.status_code, 400)
        self.assertIn("remaining balance", str(overpayment.data))

        forbidden_review = self.client.post(
            f"/api/payments/{payment.data['id']}/review/",
            {"decision": "approved"},
            format="json",
        )
        self.assertEqual(forbidden_review.status_code, 403)

        self.client.force_authenticate(self.managing_director)
        reviewed = self.client.post(
            f"/api/payments/{payment.data['id']}/review/",
            {"decision": "approved"},
            format="json",
        )
        self.assertEqual(reviewed.status_code, 200, reviewed.data)
        self.assertEqual(reviewed.data["review_status"], PaymentVoucher.ReviewStatus.APPROVED)

    def test_payment_and_supplier_bill_require_rate_for_zig(self):
        bill_data = {
            "supplier_invoice_number": "SUP-ZIG-001",
            "supplier_name": "ZiG Supplier",
            "bill_date": "2026-11-25",
            "bill_type": SupplierBill.BillType.INVENTORY,
            "description": "Parts",
            "source_reference": "GRN-ZIG-001",
            "amount": "1000.00",
            "currency": "ZiG",
            "entered_by": "Branch Clerk",
        }
        missing_bill_rate = self.client.post(reverse("supplier-bill-list"), bill_data, format="json")
        self.assertEqual(missing_bill_rate.status_code, 400)

        payment_data = {
            "voucher_number": "PAY-ZIG-001",
            "paid_date": "2026-11-25",
            "payee": "Service Provider",
            "spend_class": PaymentVoucher.SpendClass.OTHER,
            "purpose": "Local service",
            "source_reference": "SERVICE-001",
            "paid_from": "Bank ZiG",
            "method": "Bank transfer",
            "amount": "1000.00",
            "currency": "ZiG",
            "paid_by": "Branch Clerk",
        }
        missing_payment_rate = self.client.post(reverse("payment-list"), payment_data, format="json")
        self.assertEqual(missing_payment_rate.status_code, 400)
        self.assertIn("No MD-approved exchange rate", str(missing_payment_rate.data))

        self.client.force_authenticate(self.managing_director)
        rate = self.client.post(
            reverse("approved-rate-list"),
            {
                "currency": "ZiG",
                "effective_date": "2026-11-01",
                "usd_per_unit": "0.00100000",
                "source_reference": "MD-RATE-001",
            },
            format="json",
        )
        self.assertEqual(rate.status_code, 201, rate.data)
        self.client.force_authenticate(self.branch_manager)
        bill = self.client.post(reverse("supplier-bill-list"), bill_data, format="json")
        self.assertEqual(bill.status_code, 201, bill.data)
        self.assertEqual(bill.data["usd_amount"], "1.0000000000")

        payment = self.client.post(reverse("payment-list"), payment_data, format="json")
        self.assertEqual(payment.status_code, 201, payment.data)
        self.assertEqual(payment.data["usd_amount"], "1.0000000000")

    def test_cash_close_uses_server_cash_records_and_requires_variance_reference(self):
        Receipt.objects.create(
            receipt_number="CLOSE-RCT-001",
            receipt_date="2026-11-25",
            source=Receipt.Source.SAME_DAY,
            payer="Walk-in customer",
            method=Receipt.Method.CASH,
            received_into=Receipt.Destination.TILL_USD,
            currency="USD",
            amount="50.00",
            usd_per_unit="1.00000000",
            received_by="Branch cashier",
            created_by=self.branch_manager,
        )
        PaymentVoucher.objects.create(
            voucher_number="CLOSE-PAY-001",
            paid_date="2026-11-25",
            payee="Petty cash supplier",
            spend_class=PaymentVoucher.SpendClass.OTHER,
            purpose="Till payment",
            source_reference="PV-001",
            paid_from="Till USD",
            method=PaymentVoucher.Method.CASH,
            amount="20.00",
            currency="USD",
            usd_per_unit="1.00000000",
            paid_by="Branch cashier",
            review_status=PaymentVoucher.ReviewStatus.APPROVED,
            reviewed_by=self.managing_director,
            created_by=self.branch_manager,
        )
        close_data = {
            "business_date": "2026-11-25",
            "opening_usd": "100.00",
            "withdrawals_to_till_usd": "10.00",
            "deposits_to_bank_usd": "5.00",
            "actual_usd": "130.00",
            "opening_zig": "0.00",
            "withdrawals_to_till_zig": "0.00",
            "deposits_to_bank_zig": "0.00",
            "actual_zig": "0.00",
            "prepared_by": "Branch cashier",
            "witness": "Branch manager",
        }
        missing_reference = self.client.post(reverse("cash-close-list"), close_data, format="json")
        self.assertEqual(missing_reference.status_code, 400)
        self.assertIn("exception_reference", missing_reference.data)

        created = self.client.post(
            reverse("cash-close-list"),
            {**close_data, "exception_reference": "EXC-CASH-001"},
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["cash_receipts_usd"], "50.00")
        self.assertEqual(created.data["cash_payments_usd"], "20.00")
        self.assertEqual(created.data["expected_usd"], "135.00")
        self.assertEqual(created.data["variance_usd"], "-5.00")
        self.assertEqual(created.data["status_usd"], CashClose.Status.VARIANCE)
        self.assertEqual(created.data["status_zig"], CashClose.Status.OK)
        duplicate = self.client.post(
            reverse("cash-close-list"),
            {**close_data, "exception_reference": "EXC-CASH-001"},
            format="json",
        )
        self.assertEqual(duplicate.status_code, 400)

    def test_stock_movement_requires_one_sided_quantity_and_adjustment_checker(self):
        stock_data = {
            "movement_date": "2026-11-25",
            "item_code": "FILTER-01",
            "description": "Workshop filter",
            "location": "Parts store",
            "movement_type": StockMovement.MovementType.ADJUSTMENT,
            "source_reference": "SD-06-001",
            "quantity_in": "1.000",
            "quantity_out": "1.000",
            "unit_cost_usd": "12.50",
            "entered_by": "Branch manager",
        }
        both_quantities = self.client.post(reverse("stock-movement-list"), stock_data, format="json")
        self.assertEqual(both_quantities.status_code, 400)

        missing_checker = self.client.post(
            reverse("stock-movement-list"),
            {**stock_data, "quantity_out": "0.000"},
            format="json",
        )
        self.assertEqual(missing_checker.status_code, 400)
        self.assertIn("checked_by", missing_checker.data)

        created = self.client.post(
            reverse("stock-movement-list"),
            {
                **stock_data,
                "submission_id": "00000000-0000-0000-0000-000000000101",
                "quantity_out": "0.000",
                "checked_by": "MD approval reference",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["quantity_in"], "1.000")
        self.assertEqual(AuditEvent.objects.filter(entity_type="stock_movement").count(), 1)
        duplicate = self.client.post(
            reverse("stock-movement-list"),
            {
                **stock_data,
                "submission_id": "00000000-0000-0000-0000-000000000101",
                "quantity_out": "0.000",
                "checked_by": "MD approval reference",
            },
            format="json",
        )
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(StockMovement.objects.count(), 1)

    def test_exception_update_submission_id_is_idempotent(self):
        created = self.client.post(
            reverse("exception-list"),
            {
                "exception_id": "EXC-IDEMPOTENT",
                "raised_date": "2026-11-25",
                "area": "Cash close",
                "source_reference": "SD-05-002",
                "issue": "Till variance",
                "owner": "Branch manager",
                "due_date": "2026-11-26",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        update_data = {
            "submission_id": "00000000-0000-0000-0000-000000000102",
            "status": "In progress",
            "action": "Recount started",
        }
        first = self.client.post(f"/api/exceptions/{created.data['id']}/updates/", update_data, format="json")
        repeated = self.client.post(f"/api/exceptions/{created.data['id']}/updates/", update_data, format="json")
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(repeated.status_code, 200, repeated.data)
        self.assertEqual(first.data["id"], repeated.data["id"])
        self.assertEqual(ExceptionUpdate.objects.count(), 1)
        reused = self.client.post(
            f"/api/exceptions/{created.data['id']}/updates/",
            {**update_data, "action": "Different action"},
            format="json",
        )
        self.assertEqual(reused.status_code, 400)

    def test_exception_updates_are_append_only_and_md_controls_closure(self):
        exception_data = {
            "exception_id": "EXC-001",
            "raised_date": "2026-11-25",
            "area": "Cash close",
            "source_reference": "SD-05-001",
            "issue": "USD till variance",
            "amount": "5.00",
            "currency": "USD",
            "owner": "Branch manager",
            "due_date": "2026-11-26",
        }
        created = self.client.post(reverse("exception-list"), exception_data, format="json")
        self.assertEqual(created.status_code, 201, created.data)

        branch_close = self.client.post(
            f"/api/exceptions/{created.data['id']}/updates/",
            {"status": "Closed", "action": "Recount complete", "closed_date": "2026-11-25"},
            format="json",
        )
        self.assertEqual(branch_close.status_code, 403)

        self.client.force_authenticate(self.managing_director)
        missing_close_date = self.client.post(
            f"/api/exceptions/{created.data['id']}/updates/",
            {"status": "Closed", "action": "Recount complete"},
            format="json",
        )
        self.assertEqual(missing_close_date.status_code, 400)
        closed = self.client.post(
            f"/api/exceptions/{created.data['id']}/updates/",
            {"status": "Closed", "action": "Recount complete", "closed_date": "2026-11-25"},
            format="json",
        )
        self.assertEqual(closed.status_code, 201, closed.data)
        self.assertEqual(closed.data["reviewer_username"], "director")

        record = self.client.get(f"/api/exceptions/{created.data['id']}/")
        self.assertEqual(record.status_code, 200)
        self.assertEqual(record.data["status"], "Closed")
        self.assertEqual(len(record.data["updates"]), 1)
        closed_again = self.client.post(
            f"/api/exceptions/{created.data['id']}/updates/",
            {"status": "In progress", "action": "Reopened"},
            format="json",
        )
        self.assertEqual(closed_again.status_code, 400)

    def test_approved_rate_history_automatically_closes_prior_period(self):
        self.client.force_authenticate(self.managing_director)
        first = self.client.post(
            reverse("approved-rate-list"),
            {
                "currency": "ZiG",
                "effective_date": "2026-11-01",
                "usd_per_unit": "0.00100000",
                "source_reference": "MD-RATE-001",
            },
            format="json",
        )
        self.assertEqual(first.status_code, 201, first.data)
        second = self.client.post(
            reverse("approved-rate-list"),
            {
                "currency": "ZiG",
                "effective_date": "2026-11-15",
                "usd_per_unit": "0.00120000",
                "source_reference": "MD-RATE-002",
            },
            format="json",
        )
        self.assertEqual(second.status_code, 201, second.data)
        previous = ApprovedRate.objects.get(pk=first.data["id"])
        self.assertEqual(previous.effective_to.isoformat(), "2026-11-14")
        self.assertEqual(snapshot_usd_rate("ZiG", date(2026, 11, 14)), previous.usd_per_unit)
        self.assertEqual(snapshot_usd_rate("ZiG", date(2026, 11, 15)), ApprovedRate.objects.get(pk=second.data["id"]).usd_per_unit)

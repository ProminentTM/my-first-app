import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q


class Currency(models.TextChoices):
    USD = "USD", "USD"
    ZIG = "ZiG", "ZiG"


class Customer(models.Model):
    class CreditStatus(models.TextChoices):
        PENDING = "pending", "Pending MD approval"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer_code = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=120)
    proposed_credit_limit_usd = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    approved_credit_limit_usd = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    terms_days = models.PositiveSmallIntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(365)])
    credit_status = models.CharField(max_length=16, choices=CreditStatus.choices, default=CreditStatus.PENDING)
    credit_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="approved_customer_accounts",
    )
    credit_approved_at = models.DateTimeField(null=True, blank=True)
    follow_up = models.CharField(max_length=240, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_customers")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["customer_code"]
        constraints = [
            models.CheckConstraint(condition=Q(terms_days__lte=365), name="customer_terms_max_365"),
            models.CheckConstraint(
                condition=Q(proposed_credit_limit_usd__isnull=True) | Q(proposed_credit_limit_usd__gte=0),
                name="customer_proposed_limit_nonnegative",
            ),
            models.CheckConstraint(
                condition=Q(approved_credit_limit_usd__isnull=True) | Q(approved_credit_limit_usd__gte=0),
                name="customer_approved_limit_nonnegative",
            ),
        ]

    def __str__(self):
        return f"{self.customer_code} · {self.name}"


class ApprovedRate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    currency = models.CharField(max_length=3, choices=[(Currency.ZIG, "ZiG")], default=Currency.ZIG)
    effective_date = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    usd_per_unit = models.DecimalField(max_digits=18, decimal_places=8, validators=[MinValueValidator(Decimal("0.00000001"))])
    source_reference = models.CharField(max_length=100, default="Legacy approved rate")
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="approved_rates")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-effective_date", "-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["currency", "effective_date"], name="unique_rate_per_currency_day"),
            models.CheckConstraint(condition=Q(usd_per_unit__gt=0), name="approved_rate_positive"),
            models.CheckConstraint(
                condition=Q(effective_to__isnull=True) | Q(effective_to__gte=models.F("effective_date")),
                name="approved_rate_end_not_before_start",
            ),
        ]

    def __str__(self):
        return f"{self.currency} on {self.effective_date}: {self.usd_per_unit} USD/unit"


class SalesInvoice(models.Model):
    class SaleType(models.TextChoices):
        CASH = "Cash", "Cash"
        CREDIT = "Credit", "Credit"
        PART_PAID = "Part-paid", "Part-paid"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice_number = models.CharField(max_length=40, unique=True)
    sale_date = models.DateField()
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.PROTECT, related_name="sales")
    customer_name = models.CharField(max_length=120)
    description = models.CharField(max_length=160)
    amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    currency = models.CharField(max_length=3, choices=Currency.choices)
    usd_per_unit = models.DecimalField(max_digits=18, decimal_places=8)
    sale_type = models.CharField(max_length=16, choices=SaleType.choices)
    due_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_sales")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-sale_date", "invoice_number"]
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name="sales_amount_positive"),
            models.CheckConstraint(condition=Q(usd_per_unit__gt=0), name="sales_rate_positive"),
        ]

    @property
    def amount_usd(self):
        return self.amount * self.usd_per_unit

    def __str__(self):
        return f"{self.invoice_number} · {self.customer_name}"


class Receipt(models.Model):
    class Source(models.TextChoices):
        SAME_DAY = "Same-day sale payment", "Same-day sale payment"
        DEBTOR = "Debtor collection", "Debtor collection"
        DEPOSIT = "Customer deposit", "Customer deposit"
        FUNDING = "Loan/funding", "Loan/funding"
        OWNER = "Owner contribution", "Owner contribution"
        TRANSFER = "Transfer", "Transfer"
        OTHER = "Other", "Other"

    class Method(models.TextChoices):
        CASH = "Cash", "Cash"
        BANK = "Bank transfer", "Bank transfer"
        POS = "POS", "POS"
        MOBILE = "Mobile money", "Mobile money"
        CHEQUE = "Cheque", "Cheque"
        OTHER = "Other", "Other"

    class Destination(models.TextChoices):
        TILL_USD = "Till USD", "Till USD"
        TILL_ZIG = "Till ZiG", "Till ZiG"
        BANK_USD = "Bank USD", "Bank USD"
        BANK_ZIG = "Bank ZiG", "Bank ZiG"
        POS = "POS clearing", "POS clearing"
        MOBILE = "Mobile money", "Mobile money"
        OTHER = "Other", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    receipt_number = models.CharField(max_length=40, unique=True)
    receipt_date = models.DateField()
    source = models.CharField(max_length=32, choices=Source.choices)
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.PROTECT, related_name="receipts")
    payer = models.CharField(max_length=120)
    invoice = models.ForeignKey(SalesInvoice, null=True, blank=True, on_delete=models.PROTECT, related_name="receipts")
    method = models.CharField(max_length=24, choices=Method.choices)
    received_into = models.CharField(max_length=24, choices=Destination.choices)
    currency = models.CharField(max_length=3, choices=Currency.choices)
    amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    usd_per_unit = models.DecimalField(max_digits=18, decimal_places=8)
    reference = models.CharField(max_length=80, blank=True)
    received_by = models.CharField(max_length=80)
    notes = models.CharField(max_length=240, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_receipts")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-receipt_date", "-created_at"]
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name="receipt_amount_positive"),
            models.CheckConstraint(condition=Q(usd_per_unit__gt=0), name="receipt_rate_positive"),
        ]

    @property
    def amount_usd(self):
        return self.amount * self.usd_per_unit

    def __str__(self):
        return f"{self.receipt_number} · {self.payer}"


class SupplierBill(models.Model):
    class BillType(models.TextChoices):
        INVENTORY = "Inventory", "Inventory"
        OPERATING_EXPENSE = "Operating expense", "Operating expense"

    class ReviewStatus(models.TextChoices):
        PENDING = "pending", "Pending MD review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supplier_invoice_number = models.CharField(max_length=60)
    supplier_name = models.CharField(max_length=120)
    supplier_code = models.CharField(max_length=40, blank=True)
    bill_date = models.DateField()
    bill_type = models.CharField(max_length=32, choices=BillType.choices)
    category = models.CharField(max_length=80, blank=True)
    description = models.CharField(max_length=160)
    source_reference = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    currency = models.CharField(max_length=3, choices=Currency.choices)
    usd_per_unit = models.DecimalField(max_digits=18, decimal_places=8)
    due_date = models.DateField(null=True, blank=True)
    entered_by = models.CharField(max_length=80)
    notes = models.CharField(max_length=240, blank=True)
    review_status = models.CharField(max_length=16, choices=ReviewStatus.choices, default=ReviewStatus.PENDING)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="reviewed_supplier_bills",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_supplier_bills")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-bill_date", "supplier_invoice_number"]
        constraints = [
            models.UniqueConstraint(fields=["supplier_name", "supplier_invoice_number"], name="unique_supplier_invoice"),
            models.CheckConstraint(condition=Q(amount__gt=0), name="supplier_bill_amount_positive"),
            models.CheckConstraint(condition=Q(usd_per_unit__gt=0), name="supplier_bill_rate_positive"),
        ]

    @property
    def amount_usd(self):
        return self.amount * self.usd_per_unit

    def __str__(self):
        return f"{self.supplier_invoice_number} · {self.supplier_name}"


class PaymentVoucher(models.Model):
    class SpendClass(models.TextChoices):
        INVENTORY = "Inventory purchase", "Inventory purchase"
        OPERATING = "Operating expense", "Operating expense"
        SUPPLIER = "Supplier settlement", "Supplier settlement"
        LOAN = "Loan repayment", "Loan repayment"
        CAPITAL = "Capital expenditure", "Capital expenditure"
        TRANSFER = "Transfer", "Transfer"
        OTHER = "Other", "Other"

    class Method(models.TextChoices):
        CASH = "Cash", "Cash"
        BANK = "Bank transfer", "Bank transfer"
        POS = "POS", "POS"
        MOBILE = "Mobile money", "Mobile money"
        CHEQUE = "Cheque", "Cheque"
        OTHER = "Other", "Other"

    class ReviewStatus(models.TextChoices):
        PENDING = "pending", "Pending MD review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    voucher_number = models.CharField(max_length=40, unique=True)
    paid_date = models.DateField()
    payee = models.CharField(max_length=120)
    spend_class = models.CharField(max_length=32, choices=SpendClass.choices)
    category = models.CharField(max_length=80, blank=True)
    purpose = models.CharField(max_length=160)
    source_reference = models.CharField(max_length=100)
    paid_from = models.CharField(max_length=80)
    method = models.CharField(max_length=24, choices=Method.choices)
    amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    currency = models.CharField(max_length=3, choices=Currency.choices)
    usd_per_unit = models.DecimalField(max_digits=18, decimal_places=8)
    supplier_bill = models.ForeignKey(
        SupplierBill,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="payments",
    )
    paid_by = models.CharField(max_length=80)
    notes = models.CharField(max_length=240, blank=True)
    review_status = models.CharField(max_length=16, choices=ReviewStatus.choices, default=ReviewStatus.PENDING)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="reviewed_payment_vouchers",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_payment_vouchers")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-paid_date", "voucher_number"]
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name="payment_amount_positive"),
            models.CheckConstraint(condition=Q(usd_per_unit__gt=0), name="payment_rate_positive"),
        ]

    @property
    def amount_usd(self):
        return self.amount * self.usd_per_unit

    def __str__(self):
        return f"{self.voucher_number} · {self.payee}"


class CashClose(models.Model):
    class Status(models.TextChoices):
        OK = "OK", "OK"
        COUNT_MISSING = "COUNT MISSING", "Count missing"
        VARIANCE = "VARIANCE - LOG EXCEPTION", "Variance - log exception"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission_id = models.UUIDField(default=uuid.uuid4, unique=True)
    business_date = models.DateField(unique=True)
    opening_usd = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    withdrawals_to_till_usd = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    cash_receipts_usd = models.DecimalField(max_digits=14, decimal_places=2)
    cash_payments_usd = models.DecimalField(max_digits=14, decimal_places=2)
    deposits_to_bank_usd = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    expected_usd = models.DecimalField(max_digits=14, decimal_places=2)
    actual_usd = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal("0"))])
    variance_usd = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    status_usd = models.CharField(max_length=32, choices=Status.choices)
    opening_zig = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    withdrawals_to_till_zig = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    cash_receipts_zig = models.DecimalField(max_digits=14, decimal_places=2)
    cash_payments_zig = models.DecimalField(max_digits=14, decimal_places=2)
    deposits_to_bank_zig = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    expected_zig = models.DecimalField(max_digits=14, decimal_places=2)
    actual_zig = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal("0"))])
    variance_zig = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    status_zig = models.CharField(max_length=32, choices=Status.choices)
    prepared_by = models.CharField(max_length=80)
    witness = models.CharField(max_length=80)
    exception_reference = models.CharField(max_length=80, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="cash_closes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-business_date"]

    def __str__(self):
        return f"Cash close · {self.business_date}"


class StockMovement(models.Model):
    class MovementType(models.TextChoices):
        OPENING = "Opening balance", "Opening balance"
        RECEIPT = "Goods received", "Goods received"
        ISSUE = "Issue to job/sale", "Issue to job/sale"
        RETURN_IN = "Return in", "Return in"
        RETURN_TO_SUPPLIER = "Return to supplier", "Return to supplier"
        TRANSFER_IN = "Transfer in", "Transfer in"
        TRANSFER_OUT = "Transfer out", "Transfer out"
        ADJUSTMENT = "Approved adjustment", "Approved adjustment"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission_id = models.UUIDField(default=uuid.uuid4, unique=True)
    movement_date = models.DateField()
    item_code = models.CharField(max_length=40)
    description = models.CharField(max_length=120)
    location = models.CharField(max_length=80)
    movement_type = models.CharField(max_length=32, choices=MovementType.choices)
    source_reference = models.CharField(max_length=100)
    quantity_in = models.DecimalField(max_digits=16, decimal_places=3, validators=[MinValueValidator(Decimal("0"))])
    quantity_out = models.DecimalField(max_digits=16, decimal_places=3, validators=[MinValueValidator(Decimal("0"))])
    unit_cost_usd = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal("0"))])
    entered_by = models.CharField(max_length=80)
    checked_by = models.CharField(max_length=100, blank=True)
    notes = models.CharField(max_length=240, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="stock_movements")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-movement_date", "item_code", "created_at"]

    def __str__(self):
        return f"{self.item_code} · {self.movement_type}"


class OperationalException(models.Model):
    class Status(models.TextChoices):
        OPEN = "Open", "Open"
        IN_PROGRESS = "In progress", "In progress"
        AWAITING_MD = "Awaiting MD", "Awaiting MD"
        CLOSED = "Closed", "Closed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission_id = models.UUIDField(default=uuid.uuid4, unique=True)
    exception_id = models.CharField(max_length=40, unique=True)
    raised_date = models.DateField()
    area = models.CharField(max_length=80)
    source_reference = models.CharField(max_length=100)
    issue = models.CharField(max_length=240)
    amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal("0"))])
    currency = models.CharField(max_length=3, choices=Currency.choices, null=True, blank=True)
    owner = models.CharField(max_length=80)
    due_date = models.DateField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    closed_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="operational_exceptions")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-raised_date", "exception_id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__isnull=True, currency__isnull=True) | Q(amount__isnull=False, currency__isnull=False),
                name="exception_amount_currency_paired",
            ),
        ]

    @property
    def updates(self):
        return self.follow_ups.all()

    def __str__(self):
        return f"{self.exception_id} · {self.issue}"


class ExceptionUpdate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission_id = models.UUIDField(default=uuid.uuid4, unique=True)
    exception = models.ForeignKey(OperationalException, on_delete=models.PROTECT, related_name="follow_ups")
    status = models.CharField(max_length=16, choices=OperationalException.Status.choices)
    action = models.CharField(max_length=240)
    closed_date = models.DateField(null=True, blank=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="exception_updates")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.exception.exception_id} · {self.status}"


class AuditEvent(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="audit_events")
    action = models.CharField(max_length=40)
    entity_type = models.CharField(max_length=40)
    entity_id = models.CharField(max_length=64)
    details = models.JSONField(default=dict)
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_at"]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValueError("Audit events are append-only.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("Audit events are append-only.")

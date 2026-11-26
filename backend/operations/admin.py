from django.contrib import admin

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


class ReadOnlyLedgerAdmin(admin.ModelAdmin):
    def get_readonly_fields(self, request, obj=None):
        return [field.name for field in self.model._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Customer)
class CustomerAdmin(ReadOnlyLedgerAdmin):
    list_display = ("customer_code", "name", "credit_status", "approved_credit_limit_usd", "terms_days")
    list_filter = ("credit_status",)
    search_fields = ("customer_code", "name")


@admin.register(SalesInvoice)
class SalesInvoiceAdmin(ReadOnlyLedgerAdmin):
    list_display = ("invoice_number", "sale_date", "customer_name", "amount", "currency", "sale_type")
    list_filter = ("currency", "sale_type")
    search_fields = ("invoice_number", "customer_name", "customer__customer_code")


@admin.register(Receipt)
class ReceiptAdmin(ReadOnlyLedgerAdmin):
    list_display = ("receipt_number", "receipt_date", "payer", "amount", "currency", "invoice")
    list_filter = ("source", "method", "currency")
    search_fields = ("receipt_number", "payer", "invoice__invoice_number")


@admin.register(SupplierBill)
class SupplierBillAdmin(ReadOnlyLedgerAdmin):
    list_display = ("supplier_invoice_number", "supplier_name", "bill_date", "amount", "currency", "review_status")
    list_filter = ("bill_type", "currency", "review_status")
    search_fields = ("supplier_invoice_number", "supplier_name", "supplier_code")


@admin.register(PaymentVoucher)
class PaymentVoucherAdmin(ReadOnlyLedgerAdmin):
    list_display = ("voucher_number", "paid_date", "payee", "amount", "currency", "review_status")
    list_filter = ("spend_class", "currency", "review_status")
    search_fields = ("voucher_number", "payee", "source_reference")


@admin.register(ApprovedRate)
class ApprovedRateAdmin(ReadOnlyLedgerAdmin):
    list_display = ("currency", "effective_date", "usd_per_unit", "approved_by")
    list_filter = ("currency",)


@admin.register(AuditEvent)
class AuditEventAdmin(ReadOnlyLedgerAdmin):
    list_display = ("occurred_at", "actor", "action", "entity_type", "entity_id")
    list_filter = ("action", "entity_type")
    search_fields = ("entity_id", "actor__username")


@admin.register(CashClose)
class CashCloseAdmin(ReadOnlyLedgerAdmin):
    list_display = ("business_date", "status_usd", "status_zig", "prepared_by", "witness")
    list_filter = ("status_usd", "status_zig")
    search_fields = ("business_date", "prepared_by", "witness")


@admin.register(StockMovement)
class StockMovementAdmin(ReadOnlyLedgerAdmin):
    list_display = ("movement_date", "item_code", "location", "movement_type", "quantity_in", "quantity_out")
    list_filter = ("movement_type", "location")
    search_fields = ("item_code", "description", "source_reference")


@admin.register(OperationalException)
class OperationalExceptionAdmin(ReadOnlyLedgerAdmin):
    list_display = ("exception_id", "raised_date", "area", "status", "owner", "due_date")
    list_filter = ("status", "area")
    search_fields = ("exception_id", "issue", "source_reference", "owner")


@admin.register(ExceptionUpdate)
class ExceptionUpdateAdmin(ReadOnlyLedgerAdmin):
    list_display = ("exception", "status", "updated_by", "created_at")
    list_filter = ("status",)
    search_fields = ("exception__exception_id", "action", "updated_by__username")

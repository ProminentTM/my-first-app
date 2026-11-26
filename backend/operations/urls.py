from django.urls import include, path
from rest_framework.routers import DefaultRouter

from operations.views import (
    ApprovedRateViewSet,
    AuditEventViewSet,
    CashCloseViewSet,
    CustomerViewSet,
    OperationalExceptionViewSet,
    PaymentVoucherViewSet,
    HealthView,
    ReceiptViewSet,
    SalesInvoiceViewSet,
    StockMovementViewSet,
    SupplierBillViewSet,
)

router = DefaultRouter()
router.register("customers", CustomerViewSet, basename="customer")
router.register("sales", SalesInvoiceViewSet, basename="sales")
router.register("receipts", ReceiptViewSet, basename="receipt")
router.register("supplier-bills", SupplierBillViewSet, basename="supplier-bill")
router.register("payments", PaymentVoucherViewSet, basename="payment")
router.register("cash-closes", CashCloseViewSet, basename="cash-close")
router.register("stock-movements", StockMovementViewSet, basename="stock-movement")
router.register("exceptions", OperationalExceptionViewSet, basename="exception")
router.register("approved-rates", ApprovedRateViewSet, basename="approved-rate")
router.register("audit-events", AuditEventViewSet, basename="audit-event")

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("", include(router.urls)),
]

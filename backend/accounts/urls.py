from django.urls import path

from accounts.views import CurrentUserView, LogoutView

urlpatterns = [
    path("me/", CurrentUserView.as_view(), name="current-user"),
    path("logout/", LogoutView.as_view(), name="logout"),
]

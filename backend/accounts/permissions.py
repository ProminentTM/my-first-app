from rest_framework.permissions import BasePermission

from accounts.models import UserProfile


class IsBranchManagerOrManagingDirector(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        profile = getattr(user, "profile", None)
        return bool(
            profile
            and profile.role in {
                UserProfile.Role.BRANCH_MANAGER,
                UserProfile.Role.MANAGING_DIRECTOR,
            }
        )


class IsManagingDirector(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        profile = getattr(user, "profile", None)
        return bool(profile and profile.role == UserProfile.Role.MANAGING_DIRECTOR)

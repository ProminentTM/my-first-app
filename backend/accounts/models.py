from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    class Role(models.TextChoices):
        BRANCH_MANAGER = "branch_manager", "Branch Manager"
        MANAGING_DIRECTOR = "managing_director", "Managing Director"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=32, choices=Role.choices, default=Role.BRANCH_MANAGER)

    def __str__(self):
        return f"{self.user.get_username()} ({self.get_role_display()})"

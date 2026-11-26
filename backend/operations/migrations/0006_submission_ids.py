import uuid

from django.db import migrations, models


MODEL_NAMES = ("CashClose", "StockMovement", "OperationalException", "ExceptionUpdate")


def backfill_submission_ids(apps, schema_editor):
    database = schema_editor.connection.alias
    for model_name in MODEL_NAMES:
        model = apps.get_model("operations", model_name)
        for record in model.objects.using(database).filter(submission_id__isnull=True).iterator():
            model.objects.using(database).filter(pk=record.pk, submission_id__isnull=True).update(submission_id=uuid.uuid4())


class Migration(migrations.Migration):

    dependencies = [
        ("operations", "0005_cashclose_exceptionupdate_operationalexception_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="cashclose",
            name="submission_id",
            field=models.UUIDField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="stockmovement",
            name="submission_id",
            field=models.UUIDField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="operationalexception",
            name="submission_id",
            field=models.UUIDField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="exceptionupdate",
            name="submission_id",
            field=models.UUIDField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_submission_ids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="cashclose",
            name="submission_id",
            field=models.UUIDField(default=uuid.uuid4, unique=True),
        ),
        migrations.AlterField(
            model_name="stockmovement",
            name="submission_id",
            field=models.UUIDField(default=uuid.uuid4, unique=True),
        ),
        migrations.AlterField(
            model_name="operationalexception",
            name="submission_id",
            field=models.UUIDField(default=uuid.uuid4, unique=True),
        ),
        migrations.AlterField(
            model_name="exceptionupdate",
            name="submission_id",
            field=models.UUIDField(default=uuid.uuid4, unique=True),
        ),
    ]

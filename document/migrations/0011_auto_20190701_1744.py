# Generated by Django 2.2.2 on 2019-07-01 17:44
from zipfile import ZipFile

from django.db import migrations

def set_document_revision_version(apps, schema_editor):
    # Set the version number found in the zip file.
    DocumentRevision = apps.get_model('document', 'DocumentRevision')
    revisions = DocumentRevision.objects.all()
    for revision in revisions:
        zip = ZipFile(revision.file_object.path, 'r')
        version = zip.read('filetype-version')
        revision.doc_version = float(version)
        revision.save()

class Migration(migrations.Migration):

    dependencies = [
        ('document', '0010_merge_20190701_1737'),
    ]

    operations = [
        migrations.RunPython(set_document_revision_version),
    ]

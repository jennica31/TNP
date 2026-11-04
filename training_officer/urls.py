from django.urls import path
from .views import (
    get_avg_data,
    get_training_next_serial_number,
    get_sample_tcs_jobinar_notice,
)

urlpatterns = [
    path("get-avg-data/<str:table_name>/", get_avg_data, name="get_avg_data"),
    path("notice/next-serial-number/", get_training_next_serial_number, name="training_next_serial_number"),
    path("notice/sample-tcs-jobinar/", get_sample_tcs_jobinar_notice, name="training_sample_tcs_jobinar"),
]

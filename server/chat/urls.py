from django.urls import path

from . import views

urlpatterns = [
    path('chat/messages/', views.MessagesView.as_view(), name='chat-messages'),
    path('chat/read/', views.ReadView.as_view(), name='chat-read'),
    path('chat/queue/', views.QueueView.as_view(), name='chat-queue'),
    path('chat/customers/', views.MyCustomersView.as_view(), name='chat-customers'),
]

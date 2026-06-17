TOP_PATH := $(call my-dir)

# Set the Java package and class name so hev-jni.c registers native methods
# against the correct class: hev.socks5.TProxyService
VERSION_CFLAGS := -DPKGNAME=hev/socks5 -DCLSNAME=TProxyService

include $(TOP_PATH)/hev-socks5-tunnel/Android.mk

APP_ABI := armeabi-v7a arm64-v8a x86 x86_64
APP_PLATFORM := android-24
APP_CFLAGS += -O3 -DPKGNAME=hev/socks5
APP_LDFLAGS += -Wl,--build-id=none

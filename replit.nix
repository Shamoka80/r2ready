{ pkgs }: {
  deps = [
    pkgs.rsync
    pkgs.libdrm
    pkgs.xorg.libxcb
    pkgs.nspr
    pkgs.systemd
    pkgs.cairo
    pkgs.expat
    pkgs.xorg.libXrandr
    pkgs.xorg.libXfixes
    pkgs.xorg.libXext
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcomposite
    pkgs.xorg.libX11
    pkgs.gtk3
    pkgs.alsa-lib
    pkgs.pango
    pkgs.mesa
    pkgs.libxkbcommon
    pkgs.cups
    pkgs.at-spi2-atk
    pkgs.atk
    pkgs.dbus
    pkgs.nss
    pkgs.glib
    pkgs.playwright-driver
    pkgs.jq
    pkgs.zip
   pkgs.nodejs_20 pkgs.cacert ];
}

/**
 * nmcli / timedatectl output for networkService.spec.ts.
 *
 * TO REFRESH FROM THE REAL KIOSK: these were written by hand from nmcli's
 * documented terse format (`-t`: fields joined by `:`, a literal `:` or `\`
 * in a value escaped as `\:` / `\\`), not captured from a Pi. Capture the
 * same commands on the kiosk and replace them — with every SSID, MAC and
 * address swapped for a placeholder before committing (this repo is public).
 * Addresses use the RFC 5737 documentation range.
 */

/** nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status — Wi-Fi up. */
export const DEVICE_STATUS_WIFI_CONNECTED = [
  "wlan0:wifi:connected:ExampleHome",
  "lo:loopback:connected (externally):lo",
  "eth0:ethernet:unavailable:",
  "p2p-dev-wlan0:wifi-p2p:disconnected:",
  "",
].join("\n");

/** Ethernet plugged in and Wi-Fi idle. */
export const DEVICE_STATUS_ETHERNET_CONNECTED = [
  "eth0:ethernet:connected:Wired connection 1",
  "wlan0:wifi:disconnected:",
  "lo:loopback:connected (externally):lo",
  "",
].join("\n");

/** A fresh image: nothing saved, nothing up. */
export const DEVICE_STATUS_NOTHING_CONNECTED = [
  "wlan0:wifi:disconnected:",
  "eth0:ethernet:unavailable:",
  "lo:loopback:connected (externally):lo",
  "p2p-dev-wlan0:wifi-p2p:disconnected:",
  "",
].join("\n");

/** Wi-Fi still associating after boot. */
export const DEVICE_STATUS_WIFI_CONNECTING = [
  "wlan0:wifi:connecting (getting IP configuration):ExampleHome",
  "lo:loopback:connected (externally):lo",
  "",
].join("\n");

/**
 * nmcli -t -f IN-USE,SSID,SIGNAL,SECURITY device wifi list
 * Covers: the in-use row, an escaped colon in an SSID, the same SSID on two
 * access points, an open network (empty SECURITY), a hidden network (empty
 * SSID), and WPA3.
 */
export const WIFI_LIST = [
  "*:ExampleHome:72:WPA2",
  " :ExampleHome:40:WPA2",
  " :Cafe\\:Guest:55:",
  " :Neighbor 5G:81:WPA1 WPA2",
  " ::64:WPA2",
  " :Back\\\\Slash:20:WPA3",
  "",
].join("\n");

/** nmcli -t -f IP4.ADDRESS device show wlan0 */
export const DEVICE_SHOW_IP4 = ["IP4.ADDRESS[1]:192.0.2.23/24", ""].join("\n");

/** nmcli -t -f NAME,UUID,TYPE connection show */
export const CONNECTION_SHOW = [
  "ExampleHome:00000000-0000-4000-8000-000000000001:802-11-wireless",
  "Wired connection 1:00000000-0000-4000-8000-000000000002:802-3-ethernet",
  "ExampleHome 1:00000000-0000-4000-8000-000000000003:802-11-wireless",
  "lo:00000000-0000-4000-8000-000000000004:loopback",
  "",
].join("\n");

/** nmcli --wait 25 device wifi connect <ssid> password <wrong> (exit 4). */
export const CONNECT_WRONG_PASSWORD_STDERR =
  "Error: Connection activation failed: (7) Secrets were required, but not provided.\n";

/** nmcli device wifi connect <ssid not in range> (exit 10). */
export const CONNECT_NOT_FOUND_STDERR = "Error: No network with SSID 'Gone' found.\n";

/** nmcli device wifi connect success (exit 0). */
export const CONNECT_OK_STDOUT =
  "Device 'wlan0' successfully activated with '00000000-0000-4000-8000-000000000001'.\n";

/** timedatectl list-timezones --no-pager (abridged). */
export const TIMEZONES = ["Africa/Abidjan", "America/Chicago", "America/New_York", "Europe/London", "UTC", ""].join("\n");

# homebridge-nasnos

Homebridge plugin for NASNOS CS8700 (ナスノス　Wi-Fiコントローラー).

## Usage

```js
"accessories": [
  {
    "accessory": "NasnosCurtain",
    "name": "Curtain",
    "index": 1,
    "period": 20000,
    "ip": "172.16.80.45"
  }
]
```

* `index`: The ID of curtain to control, from 1 to 5.
* `period`: Time spent to fully open/close the curtain, in milliseconds.
* `ip`: The IP address of the NASNOS Wi-Fi Controller.

## License

[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)

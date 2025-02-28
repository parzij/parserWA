# **parserWA**

The project is a parser for WhatsApp that receives text messages with information about work shifts, sends them for processing in YandexGPT, and saves the structured JSON with data about shifts, workers, and tasks.

---

## **WhatsApp Web Parser for Production Workflow**

This parser is implemented using [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) and is intended for automating the parsing of work shift data. The bot:
- Generates a QR code for logging into WhatsApp Web.
- Listens for incoming messages and sends them for parsing.
- Uses the YandexGPT API to convert unstructured text into JSON according to a specified template.
- Saves the result in the file `output.json`.

---

## **Features**

- **QR Code for Authentication:** Scan the QR code generated in the console to connect to your WhatsApp.
- **YandexGPT Integration:** Automatic processing of text messages and conversion into structured JSON.
- **Flexible Parser:** Supports various input formats, including date, arrival/departure times, worker information, machine details, and additional data.

---

## **Installation**

1. **Install dependencies:**

```
npm install whatsapp-web.js qrcode-terminal axios
```
---

Before running the project, you need to:

2. **Set up YandexGPT API:**

In the code file, replace the placeholders Api-key and x-folder-id with the actual values obtained from your Yandex Cloud account.  
Ensure that you have access to the YandexGPT API.

## **Usage**
1. **Run the application:**

2. **Scan the QR code:**

After starting, a QR code will be displayed in the console. Scan it using the WhatsApp app to connect.

3. **Send a message:**

Send a text message with shift data in the format described in the code (see examples below).

---

## **Usage Examples:**

Example of an incoming message:
```
13.12 Игнатьев приход 6 30 уход 18 30
Лп1
417857 36/182 16шт
Лп2
417935 30/185 9шт
418117 22/140 1шт
414862 36/272 1шт
414862 30/160 1шт
Лп3
418039 30/138 8шт
417986 32/200 3шт
417888 28/170 1шт
Везде подрезка
```
Пример полученного JSON:

```
[
  {
    "date": "13.12.2025",
    "shift": "1",
    "workers": [
      {
        "name": "Игнатьев",
        "time": {
          "arrival": "6:30",
          "departure": "18:30"
        },
        "machines": [
          {
            "name": "Лп1",
            "tasks": [
              {
                "batch": "417857",
                "volume": "36/182",
                "quantity": 16,
                "addInfo": ""
              }
            ]
          },
          {
            "name": "Лп2",
            "tasks": [
              {
                "batch": "417935",
                "volume": "30/185",
                "quantity": 9,
                "addInfo": ""
              },
              {
                "batch": "418117",
                "volume": "22/140",
                "quantity": 1,
                "addInfo": ""
              },
              {
                "batch": "414862",
                "volume": "36/272",
                "quantity": 1,
                "addInfo": ""
              },
              {
                "batch": "414862",
                "volume": "30/160",
                "quantity": 1,
                "addInfo": ""
              }
            ]
          },
          {
            "name": "Лп3",
            "tasks": [
              {
                "batch": "418039",
                "volume": "30/138",
                "quantity": 8,
                "addInfo": ""
              },
              {
                "batch": "417986",
                "volume": "32/200",
                "quantity": 3,
                "addInfo": ""
              },
              {
                "batch": "417888",
                "volume": "28/170",
                "quantity": 1,
                "addInfo": ""
              }
            ]
          }
        ]
      }
    ],
    "additionalInfo": "Везде подрезка"
  }
]
```
---

**Project Architecture:**
1. WhatsApp Client: Uses the qr, ready, and message events to manage the WhatsApp session.
2. QR Code Terminal: Generates a QR code in the console for quick connection.
3. YandexGPT Integration: The `testYandexGPT` function sends text for processing to YandexGPT and receives structured JSON.
4. File System: Processing results are saved to the `output.json` file using the fs module.

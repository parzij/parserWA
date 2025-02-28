const { Client } = require('whatsapp-web.js');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// Create the WhatsApp client
const client = new Client();

// Generate the QR code for WhatsApp Web scanning
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Scan this QR code with your WhatsApp');
});

// When the client is ready
client.on('ready', () => {
    console.log('Client is ready!');
});

// Listen for incoming messages
client.on('message', async (message) => {
    // If the message contains text, pass it for parsing
    if (message.body) {
        await getParsedDataFromAPI(message.body);
    }
});

// Function to parse the message using YandexGPT
async function getParsedDataFromAPI(messageText) {
  const prompt = `
  Ты — парсер, который должен обрабатывать текстовые сообщения с данными о рабочих сменах и составлять структурированный JSON по следующему шаблону:
    
    1. **Дата**:
      - Если дата явно указана в тексте, извлеки её в формате "дд.мм.гггг".
      - Если дата не указана, используй текущую дату.

    2. **Смена**:
      - Если время прихода работника раньше 12:00, то смена "1".
      - Если время прихода работника 12:00 или позже, то смена "2".

    3. **Работники**:
      - Для каждого работника извлеки:
        - Имя (например, "Игнатьев").
        - Время прихода и ухода (в формате "часы:минуты").
        - Задачи по станкам, если есть (для каждого станка перечисли batch, volume, quantity и addInfo).

    4. **Станки и задачи**:
      - Если станок указан (например, "Лп1"), все последующие задачи до следующего станка относятся к этому станку.
      - Для каждой задачи извлеки:
        - batch: Номер партии (убери скобки и цифры в скобках, если они есть).
        - volume: Объем/параметры (например, "40/203").
        - quantity: Количество (только число).
        - addInfo: Дополнительная информация (например, "подрезка").
        - Если дополнительная информация относится только к одной задаче, добавь её в addInfo этой задачи.
        - Если дополнительная информация относится ко всем задачам станка, добавь её в addInfo каждой задачи.
      - **Важно**: Все станки, указанные в тексте, должны быть включены в JSON, даже если они идут после неработающих станков или других заметок.

    5. **Дополнительная информация**:
      - Собери всю информацию, которая не касается рабочих и станков, и добавь её в поле "additionalInfo", разделяя точкой с запятой.
      - Если станок не работает (например, "Лп52 не работает" или "Мшс4 не работает"), добавь это в "additionalInfo".
      - **Важно**: Все неработающие станки, независимо от их расположения в тексте, должны быть включены в "additionalInfo".

    6. **Формат JSON**:
      - Результат должен быть массивом объектов, каждый из которых соответствует одной смене.
      - Пример структуры JSON:

    [
      {
        "date": "дд.мм.гггг",
        "shift": "1 или 2",
        "workers": [
          {
            "name": "Имя работника",
            "time": {
              "arrival": "часы:минуты",
              "departure": "часы:минуты"
            },
            "machines": [
              {
                "name": "Название станка",
                "tasks": [
                  {
                    "batch": "Номер партии (без скобок и цифр в скобках)",
                    "volume": "Объем/параметры",
                    "quantity": "Количество",
                    "addInfo": "Дополнительная информация"
                  },
                  ...
                ]
              },
              ...
            ]
          },
          ...
        ],
        "additionalInfo": "Дополнительная информация, разделенная точкой с запятой"
      }
    ]
    
    **Пример 1**:
    Текст сообщения:
    Елизаров приход 6 20
    Уход 18 20
    Мшс1 
    417850 20/120 1шт пробник подрезка + торцовка 417814 16/140 6шт
    Мшс3 418054 18/132 10шт потреска+торцовка
    417992 18/100 20шт подрезка + торцовка
    Мшс5 не работает масляный фильтр
    Мшс4 417992 18/100 22шт подрезка + торцовка
    Везде снятые фаски!
    
    Ожидаемый JSON:
    [
      {
        "date": "19.02.2025",
        "shift": "1",
        "workers": [
          {
            "name": "Елизаров",
            "time": {
              "arrival": "6:20",
              "departure": "18:20"
            },
            "machines": [
              {
                "name": "Мшс1",
                "tasks": [
                  {
                    "batch": "417850",
                    "volume": "20/120",
                    "quantity": 1,
                    "addInfo": "пробник подрезка + торцовка"
                  },
                  {
                    "batch": "417814",
                    "volume": "16/140",
                    "quantity": 6,
                    "addInfo": ""
                  }
                ]
              },
              {
                "name": "Мшс3",
                "tasks": [
                  {
                    "batch": "418054",
                    "volume": "18/132",
                    "quantity": 10,
                    "addInfo": "потреска+торцовка"
                  },
                  {
                    "batch": "417992",
                    "volume": "18/100",
                    "quantity": 20,
                    "addInfo": "подрезка + торцовка"
                  }
                ]
              },
              {
                "name": "Мшс4",
                "tasks": [
                  {
                    "batch": "417992",
                    "volume": "18/100",
                    "quantity": 22,
                    "addInfo": "подрезка + торцовка"
                  }
                ]
              }
            ]
          }
        ],
        "additionalInfo": "Мшс5 не работает масляный фильтр; Везде снятые фаски!"
      }
    ]
    
    **Пример 2**:
    Текст сообщения:
    Ткачев приход 18:30 уход 6:30
    Мшс3
    418061 16/125 22шт
    417921 20/190 4шт
    418168 16/145 1шт
    Везде падреска фаска
    Мшс4 на ремонте не вращается камень
    Мшс2 чистка трубы
    
    Ожидаемый JSON:
    [
      {
        "date": "19.02.2025",
        "shift": "2",
        "workers": [
          {
            "name": "Ткачев",
            "time": {
              "arrival": "18:30",
              "departure": "6:30"
            },
            "machines": [
              {
                "name": "Мшс3",
                "tasks": [
                  {
                    "batch": "418061",
                    "volume": "16/125",
                    "quantity": 22,
                    "addInfo": ""
                  },
                  {
                    "batch": "417921",
                    "volume": "20/190",
                    "quantity": 4,
                    "addInfo": ""
                  },
                  {
                    "batch": "418168",
                    "volume": "16/145",
                    "quantity": 1,
                    "addInfo": ""
                  }
                ]
              }
            ]
          }
        ],
        "additionalInfo": "Везде падреска фаска; Мшс4 на ремонте не вращается камень; Мшс2 чистка трубы"
      }
    ]

    **Пример 3**:
    Текст сообщения:
    15.12.2025 1 смена Фирсов приход 6:20 уход 18:20
    Лп1 414862(2) 30/160 1шт+подрезка
    418188(3) 32/160 13шт+подрезка
    417888 28/170 5шт+подрезка
    Лп2 417888 28/170 7шт+подрезка
    417761(10) 34/206 1шт+подрезка
    417990 40/245 2шт+подрезка
    418117 22/140 8шт+подрезка
    Лп3 418117 22/140 18шт+подрезка
    Лп4 418117 22/140 18шт+подрезка
    
    Ожидаемый JSON:
    [
      {
        "date": "15.12.2025",
        "shift": "1",
        "workers": [
          {
            "name": "Фирсов",
            "time": {
              "arrival": "6:20",
              "departure": "18:20"
            },
            "machines": [
              {
                "name": "Лп1",
                "tasks": [
                  {
                    "batch": "414862",
                    "volume": "30/160",
                    "quantity": 1,
                    "addInfo": "подрезка"
                  },
                  {
                    "batch": "418188",
                    "volume": "32/160",
                    "quantity": 13,
                    "addInfo": "подрезка"
                  },
                  {
                    "batch": "417888",
                    "volume": "28/170",
                    "quantity": 5,
                    "addInfo": "подрезка"
                  }
                ]
              },
              {
                "name": "Лп2",
                "tasks": [
                  {
                    "batch": "417888",
                    "volume": "28/170",
                    "quantity": 7,
                    "addInfo": "подрезка"
                  },
                  {
                    "batch": "417761",
                    "volume": "34/206",
                    "quantity": 1,
                    "addInfo": "подрезка"
                  },
                  {
                    "batch": "417990",
                    "volume": "40/245",
                    "quantity": 2,
                    "addInfo": "подрезка"
                  },
                  {
                    "batch": "418117",
                    "volume": "22/140",
                    "quantity": 8,
                    "addInfo": "подрезка"
                  }
                ]
              },
              {
                "name": "Лп3",
                "tasks": [
                  {
                    "batch": "418117",
                    "volume": "22/140",
                    "quantity": 18,
                    "addInfo": "подрезка"
                  }
                ]
              },
              {
                "name": "Лп4",
                "tasks": [
                  {
                    "batch": "418117",
                    "volume": "22/140",
                    "quantity": 18,
                    "addInfo": "подрезка"
                  }
                ]
              }
            ]
          }
        ],
        "additionalInfo": ""
      }
    ]

    **Пример 4**:
    Текст сообщения:
    14.12 2смена Игнатьев приход 18 30 уход 6 30
    Лп5 не работает
    Лп1
    418193 40/203 1шт
    418009 36/166 1шт
    414585 36/216 1шт
    418188 25/140 1шт
    418193 25/117 1шт
    417990 40/245 1шт
    418039 30/138 7шт
    Лп2
    418188 32/160 17шт
    Мшс4 не работает
    Лп3
    417935 50/295 9шт
    414862 30/160 6шт
    Везде подрезка
    
    Ожидаемый JSON:
    [
      {
        "date": "14.12.2025",
        "shift": "2",
        "workers": [
          {
            "name": "Игнатьев",
            "time": {
              "arrival": "18:30",
              "departure": "6:30"
            },
            "machines": [
              {
                "name": "Лп1",
                "tasks": [
                  {
                    "batch": "418193",
                    "volume": "40/203",
                    "quantity": 1,
                    "addInfo": ""
                  },
                  {
                    "batch": "418009",
                    "volume": "36/166",
                    "quantity": 1,
                    "addInfo": ""
                  },
                  {
                    "batch": "414585",
                    "volume": "36/216",
                    "quantity": 1,
                    "addInfo": ""
                  },
                  {
                    "batch": "418188",
                    "volume": "25/140",
                    "quantity": 1,
                    "addInfo": ""
                  },
                  {
                    "batch": "418193",
                    "volume": "25/117",
                    "quantity": 1,
                    "addInfo": ""
                  },
                  {
                    "batch": "417990",
                    "volume": "40/245",
                    "quantity": 1,
                    "addInfo": ""
                  },
                  {
                    "batch": "418039",
                    "volume": "30/138",
                    "quantity": 7,
                    "addInfo": ""
                  }
                ]
              },
              {
                "name": "Лп2",
                "tasks": [
                  {
                    "batch": "418188",
                    "volume": "32/160",
                    "quantity": 17,
                    "addInfo": "подрезка"
                  }
                ]
              },
              {
                "name": "Лп3",
                "tasks": [
                  {
                    "batch": "417935",
                    "volume": "50/295",
                    "quantity": 9,
                    "addInfo": "подрезка"
                  },
                  {
                    "batch": "414862",
                    "volume": "30/160",
                    "quantity": 6,
                    "addInfo": "подрезка"
                  }
                ]
              }
            ]
          }
        ],
        "additionalInfo": "Лп5 не работает; Мшс4 не работает; Везде подрезка"
      }
    ]
    
    Текст сообщения: ${messageText}
    Ты должен вернуть результат в формате JSON, как показано в примерах выше.
  `;

    await testYandexGPT(messageText, prompt);
}

// Function to send a request to YandexGPT for parsing
async function testYandexGPT(messageText, prompt) {
    const url = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';
    const headers = {
        'Authorization': 'Api-key AQVNyrrmzW335SlVJ2CzOpQhDxyXLLqgIoCpobAK',
        'x-folder-id': 'b1gmjfgs5bk149th9760'
    };

    const data = {
        modelUri: 'gpt://b1gmjfgs5bk149th9760/yandexgpt-lite',
        completionOptions: {
            stream: false,
            temperature: 0.6,
            maxTokens: 2000
        },
        messages: [
            {
                role: 'user',
                text: prompt + messageText
            }
        ]
    };

    try {
        const response = await axios.post(url, data, { headers });
        console.log('Response from Yandex GPT:', response.data);

        if (response.data.result && response.data.result.alternatives && response.data.result.alternatives.length > 0) {
            const reply = response.data.result.alternatives[0].message.text;
            const jsonString = reply.replace(/```/g, '').trim();
            const jsonData = JSON.parse(jsonString);

            // Overwrite the existing JSON file with the new data
            fs.writeFileSync('output.json', JSON.stringify(jsonData, null, 2));
            console.log('JSON file has been updated with the parsed data.');
        } else {
            console.log('No valid alternatives found.');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Start the WhatsApp client
client.initialize();

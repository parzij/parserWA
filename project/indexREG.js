const { Client } = require('whatsapp-web.js');
const fs = require('fs');
const qrcode = require('qrcode-terminal');

const client = new Client();

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', (message) => {
    const parsedData = parseMessage(message.body);
    saveToFile(parsedData);
});

function saveToFile(parsedData) {
    fs.readFile('messages.json', 'utf8', (err, data) => {
        let messages = [];
        if (!err && data) {
            try {
                messages = JSON.parse(data);
            } catch (parseError) {
                console.error('Error parsing JSON:', parseError);
            }
        }

        messages.push(parsedData);

        fs.writeFile('messages.json', JSON.stringify(messages, null, 2), (writeErr) => {
            if (writeErr) console.error('Write error:', writeErr);
        });
    });
}

function parseMessage(originalMessage) {
    const workerNames = ['Гараев', 'Белов', 'Ткачев', 'Игнатьев', 'Елизаров', 'Фирсов', 'Давлетшин'];
    const machines = ['Лп1', 'Лп2', 'Лп3', 'Лп4', 'Мшс1', 'Мшс2', 'Мшс3', 'Мшс4', 'Ручная шлифовка'];
    
    const parsedData = {
        date: '',
        shift: '',
        workers: [],
        additionalInfo: '',
    };

    // 1. Обработка даты
    const cleanedMessage = originalMessage.replace(/\(\d+\)/g, '');
    const dateMatch = cleanedMessage.match(/\d{2}\.\d{2}(\.\d{4})?/);
    if (dateMatch) {
        const dateParts = dateMatch[0].split('.');
        parsedData.date = dateParts.length === 2 
            ? `${dateParts[0]}.${dateParts[1]}.${new Date().getFullYear()}`
            : dateMatch[0];
    } else {
        const now = new Date();
        parsedData.date = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth()+1).padStart(2, '0')}.${now.getFullYear()}`;
    }

    // 2. Парсинг работников
    workerNames.forEach(workerName => {
        if (!cleanedMessage.includes(workerName)) return;

        const worker = {
            name: workerName,
            time: { arrival: '', departure: '' },
            machines: []
        };

        // Время прихода/ухода
        const arrivalMatch = cleanedMessage.match(new RegExp(`${workerName}\\s+приход\\s+(\\d{1,2})[\\s.:]+(\\d{2})`, 'i'));
        if (arrivalMatch) worker.time.arrival = `${arrivalMatch[1]}:${arrivalMatch[2]}`;
        
        const departureMatch = cleanedMessage.match(/уход\s+(\d{1,2})[\s.:]+(\d{2})/i);
        if (departureMatch) worker.time.departure = `${departureMatch[1]}:${departureMatch[2]}`;

        // Парсинг станков
        const machineRegex = new RegExp(`(${machines.join('|')})`, 'gi');
        const machineMatches = [...cleanedMessage.matchAll(machineRegex)]
            .map(match => ({ name: match[0], index: match.index }))
            .sort((a, b) => a.index - b.index);

        for (let i = 0; i < machineMatches.length; i++) {
            const machine = machineMatches[i];
            const nextIndex = i < machineMatches.length - 1 ? machineMatches[i+1].index : cleanedMessage.length;
            const section = cleanedMessage.slice(machine.index, nextIndex);
            
            const tasks = parseTasksInSection(section, machines);
            if (tasks.length > 0) {
                worker.machines.push({
                    name: machine.name,
                    tasks
                });
            }
        }

        parsedData.workers.push(worker);
    });

    // 3. Определение смены
    parsedData.shift = determineShift(parsedData.workers);

    // 4. Улучшенный сбор additionalInfo
    const lines = originalMessage.split('\n').map(line => line.trim());
    const additionalInfoParts = [];
    const taskPattern = /\d{6}/;
    const workerPattern = new RegExp(workerNames.join('|'), 'i');

    lines.forEach(line => {
        let isTechnicalLine = false;

        // Обработка "Везде"
        if (/^Везде/gi.test(line)) {
            const info = line.replace(/^Везде\s*/gi, '').trim();
            if (info) additionalInfoParts.push(`Везде ${info}`);
            isTechnicalLine = true;
        }

        // Обработка станков без задач
        const machineMatch = line.match(new RegExp(`^(${machines.join('|')})\\b`, 'i'));
        if (machineMatch && !isTechnicalLine) {
            const rest = line.substring(machineMatch[0].length).trim();
            if (!taskPattern.test(rest)) {
                additionalInfoParts.push(line);
                isTechnicalLine = true;
            }
        }

        // Обработка свободных строк
        if (!isTechnicalLine && 
            !taskPattern.test(line) && 
            !workerPattern.test(line) && 
            line.length > 0) {
            additionalInfoParts.push(line);
        }
    });

    // Фильтрация и форматирование
    parsedData.additionalInfo = additionalInfoParts
        .filter((item, index, arr) => arr.indexOf(item) === index)
        .join('; ')
        .replace(/\s+/g, ' ')
        .trim();

    return parsedData;
}

function parseTasksInSection(section, machines) {
    // Удаление упоминаний "Везде"
    section = section.replace(/Везде\s+.*/gi, '');

    const firstMachineRegex = new RegExp(`^(${machines.join('|')})\\s*`, 'i');
    section = section.replace(firstMachineRegex, '');
    
    const tasks = [];
    const taskPattern = /(\d{6})\s+(\d{2}\/\d{2,3})\s+(\d+)(?:шт)?/gi;
    let lastIndex = 0;
    let match;

    while ((match = taskPattern.exec(section)) !== null) {
        const betweenText = section.slice(lastIndex, match.index);
        if (tasks.length > 0) {
            tasks[tasks.length-1].addInfo += betweenText.trim();
        }
        
        tasks.push({
            batch: match[1],
            volume: match[2],
            quantity: parseInt(match[3], 10),
            addInfo: ''
        });
        
        lastIndex = taskPattern.lastIndex;
    }

    // Обработка хвоста
    if (tasks.length > 0) {
        const tail = section.slice(lastIndex).trim();
        tasks[tasks.length-1].addInfo += tail;
    }

    // Очистка доп. информации
    tasks.forEach(task => {
        task.addInfo = task.addInfo
            .replace(/\s+/g, ' ')
            .replace(/Везде\s+.*/g, '')
            .trim();
    });

    return tasks.filter(task => task.batch);
}

function determineShift(workers) {
    if (!workers.length) return '1';
    
    let earliestHour = 24;
    workers.forEach(worker => {
        if (worker.time.arrival) {
            const [hour] = worker.time.arrival.split(':');
            const h = parseInt(hour, 10);
            if (h < earliestHour) earliestHour = h;
        }
    });
    
    return earliestHour < 12 ? '1' : '2';
}

client.initialize();

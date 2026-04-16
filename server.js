const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // This allows opening http://localhost:3000/3d.html

let currentData = { height: 0, setpoint: 6.5 };
const TANK_HEIGHT_CM = 13.0;

// Change 'COM4' to your actual Arduino port if different
const port = new SerialPort({ path: 'COM4', baudRate: 9600 }, (err) => {
    if (err) console.log('ERROR: Close Arduino Serial Monitor first!');
});

const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
parser.on('data', (data) => {
    try {
        const json = JSON.parse(data);
        if (json.distance !== undefined) {
            // Distance is empty space, so Height = Total - Distance
            currentData.height = Math.max(0, TANK_HEIGHT_CM - json.distance);
        }
    } catch (e) { }
});

app.get('/data', (req, res) => res.json(currentData));

app.post('/control', (req, res) => {
    const spValue = parseFloat(req.body.setpoint);
    currentData.setpoint = spValue;
    if (port.isOpen) {
        // Sends {"sp": 6.5} to Arduino
        port.write(JSON.stringify({ sp: spValue }) + "\n");
    }
    res.sendStatus(200);
});

app.listen(3000, () => console.log('Server running: http://localhost:3000/3d.html'));
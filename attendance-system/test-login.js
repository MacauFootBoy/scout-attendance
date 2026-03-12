const http = require('http');
const data = JSON.stringify({username: 'admin', password: 'scout5th'});
const req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/api/admin/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => console.log(d));
});
req.on('error', e => console.error(e));
req.write(data);
req.end();

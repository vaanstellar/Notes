let fs = require('fs');
let indexFile = require('./index');

const testHandler = () => {
  const applicationHtml = fs.readFileSync('./testData.html');
  
  indexFile.handler({
    applicationHtml,
    devMode: true
  });
}

testHandler();
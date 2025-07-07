const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

// uncomment when you run this in local
// wkhtmltopdf.command = "./mac/wkhtmltopdf";

// eslint-disable-next-line no-unused-vars
const ASSETS_S3_KEY = 'assets';

process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];
process.env['FONTCONFIG_PATH'] = process.env['LAMBDA_TASK_ROOT'] + '/fonts';

const awsService = require('./awsService');
const date = new Date();
const options = {
  pageSize: 'letter',
  footerRight: `INCOME/Onlinelife/${date.getMonth() + 1}/${date.getFullYear()}  ●  Page [page] of [toPage]`,
  footerFontSize: 8,
  footerSpacing: 2
};

const LAMBDA_NAME = 'HtmlToPdfLambda';

const convertToPdf = async (applicationHtml) => {
  let browser = null;
  let buffer = null;
  try {
    // creating puppeteer browser instance
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    // Create a new page
    const page = await browser.newPage();

    // setting the html content
    await page.setContent(applicationHtml, { waitUntil: ["load", "networkidle0", "domcontentloaded"] });

    // To reflect CSS used for screens instead of print
    await page.emulateMediaType("screen");

    // If you are using custom fonts
    await page.evaluateHandle("document.fonts.ready");

    // configurations for generating pdfs
    const pdf = await page.pdf({
      margin: { top: "100px", right: "50px", bottom: "100px", left: "50px" },
      printBackground: true,
      format: "A4",
      footerTemplate: `INCOME/Onlinelife/${date.getMonth() + 1}/${date.getFullYear()}  ●  Page [page] of [toPage]`
    });

    buffer = Buffer.from(pdf, 'base64');

    return buffer;
  } catch (error) {
    console.log("convertToPdfWithPuppeteer error: ", error);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
  return buffer;
}

const checkProcessed = (event) => {
  const processed = event.proceessedLambdas;
  if (processed && processed.indexOf(LAMBDA_NAME) !== -1)
    return true;
  return false;
};

const addProcessed = (event) => {
  const processed = event.proceessedLambdas;
  if (processed) {
    event['proceessedLambdas'] = `${processed}|${LAMBDA_NAME}`;
  }
  else {
    event['proceessedLambdas'] = LAMBDA_NAME;
  }
};

exports.handler = async (event) => {
  try {
    if (event.devMode) {
      const result = await convertToPdf(event.applicationHtml);
      return { result,...event };
    }
    if (checkProcessed(event)) {
      return event;
    }
    event['currentTask'] = LAMBDA_NAME;
    const assetsBucket = event.assetsSourceBucket;
    for (const index in event.htmlSourceForPDF) {
      const config = event.htmlSourceForPDF[index];

      // the logos are already in HTML file, taken from kentico
      // await awsService.downloadPdfAssetsFromS3(assetsBucket, ASSETS_S3_KEY);

      console.log('getting applicationHtml');
      const applicationHtml = await awsService.getFileFromBucket(config.inputS3Path.s3Bucket, config.inputS3Path.s3Key);

      console.log('convert To Pdf');
      const bufferData = await convertToPdf(applicationHtml);

      console.log('upload File To Bucket');
      // eslint-disable-next-line no-unused-vars
      const uploadedResult = await awsService.uploadFileToBucket(config.outputS3Path.s3Bucket, config.outputS3Path.s3Key, bufferData);

      console.log('uploadedResult');
      event.htmlSourceForPDF[index].isProcessed = true;
    }
    addProcessed(event);
    return event;

  } catch (error) {
    console.log(error);
    throw error;
  }
};

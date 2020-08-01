require('dotenv').config();
const puppeteer = require('puppeteer');
const yargs = require('yargs');

const argv = yargs
  .option('year', {
    alias: 'y'
  })
  .option('month', {
    alias: 'm'
  })
  .help()
  .argv

const today = new Date();
const year = argv['year'] ? argv['year'] : today.getFullYear().toString();
const month = argv['month'] ? argv['month'] : (today.getMonth() + 1).toString();
const targetUrl = `https://attendance.moneyforward.com/my_page/attendances?day=1&month=${month}&year=${year}`

const getRandomInt = (min, max) => {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min)) + min;
}

const getInTime = () => {
  const minute = getRandomInt(0, 59).toString().padStart(2, '0');
  const hour = getRandomInt(9, 10).toString().padStart(2, '0');
	return hour + ':' + minute;
}

const getOutTime = () => {
  const minute = getRandomInt(0, 59).toString().padStart(2, '0');
  const hour = getRandomInt(19, 21).toString();
	return hour + ':' + minute;
}

(async () => {
  const browser = await puppeteer.launch({headless: false});
  const page = await browser.newPage();
  await page.setViewport({width: 1600, height: 1200});
  await page.goto(targetUrl, {waitUntil: "domcontentloaded"});
  await page.waitFor(500);

  await page.type('#employee_session_form_office_account_name', process.env.OFFICE_ACCOUNT_NAME);
  await page.type('#employee_session_form_account_name_or_email', process.env.ACCOUNT_NAME_OR_EMAIL);
  await page.type('#employee_session_form_password', process.env.ACCOUNT_PASSWORD);
  await page.click('input[type="submit"]');

  while(true) {
    await page.waitFor(5000);
    const errorRows = await page.$$('.attendance-table-row-error');
    if (errorRows.length == 0) break;

    const row = errorRows[0]
    const editElement = await row.$('.column-edit a');
    await editElement.click();
    await page.waitFor(2000);

    const addButton = await page.$('.attendance-with-plus-icon-normally');
    await addButton.click();
    await page.waitFor(200);
    await addButton.click();
    await page.waitFor(200);

    await page.select('select[name="attendance_form[attendance_record_forms_attributes][1][event]"', 'clock_out');
    await page.type('input[name="attendance_form[attendance_record_forms_attributes][0][time]"]', getInTime());
    await page.waitFor(200);
    await page.type('input[name="attendance_form[attendance_record_forms_attributes][1][time]"]', getOutTime());

    await page.click('input[type="submit"]');
  }

  const shinseiButton = await page.$('.attendance-table-header-action a.attendance-button-primary');
  await shinseiButton.click();
  await page.waitFor(2000);

  await page.click('input[type="submit"]');
  await page.waitFor(2000);

  await browser.close();
})();
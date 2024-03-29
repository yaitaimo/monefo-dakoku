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

if(!process.env.ACCOUNT_NAME_OR_EMAIL) {
  throw new Error('ACCOUNT_NAME_OR_EMAIL is not defined. Please check env file.')
}

if(!process.env.ACCOUNT_PASSWORD) {
  throw new Error('ACCOUNT_PASSWORD is not defined. Please check env file.')
}

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
  const minute = getRandomInt(30, 59).toString().padStart(2, '0');
  const hour = getRandomInt(9, 10).toString().padStart(2, '0');
  return hour + ':' + minute;
}

const getOutTime = () => {
  const minute = getRandomInt(0, 59).toString().padStart(2, '0');
  const hour = getRandomInt(19, 20).toString();
  return hour + ':' + minute;
}

const editAttendanceForm = async (page) => {
  await page.waitFor('.attendance-table-header-title')
  const date = await page.$$eval('.attendance-table-header-title', list => {
    return list[1].textContent;
  })
  const addButton = await page.$('.attendance-with-plus-icon-normally');
  await addButton.click();
  await page.waitFor(200);
  await addButton.click();
  await page.waitFor(200);

  const inTime = getInTime();
  const outTime = getOutTime();
  await page.select('select[name="attendance_form[attendance_record_forms_attributes][1][event]"', 'clock_out');
  await page.type('input[name="attendance_form[attendance_record_forms_attributes][0][time]"]', inTime);
  await page.waitFor(200);
  await page.type('input[name="attendance_form[attendance_record_forms_attributes][1][time]"]', outTime);

  console.log(`${date}: ${inTime} - ${outTime}`);
  await page.click('input[name="commit"]');
}

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({width: 1600, height: 1200});
  await page.goto(targetUrl, {waitUntil: "domcontentloaded"});

  await page.click('.attendance-button-mfid.attendance-button-link.attendance-button-size-wide')
  await page.waitFor(1000);

  await page.type('input[name="mfid_user[email]"', process.env.ACCOUNT_NAME_OR_EMAIL)
  await page.click('input.submitBtn')

  await page.waitFor(1000);

  await page.type('input[name="mfid_user[password]"]', process.env.ACCOUNT_PASSWORD)
  await page.click('input.submitBtn')

  await page.waitFor(5000);

  await page.goto(targetUrl, {waitUntil: "domcontentloaded"});
  await page.waitFor(5000);
  const closeButton = await page.$('.karte-close');
  await closeButton.click();

  await page.waitFor(5000);
  // const rows = await page.$$('.attendance-table-row-');
  const rows = await page.$$eval(
      '.attendance-table-row-',
      (rows => {
        return rows.map(row => {
          // 勤務日チェック
          const kinmubi = row.querySelector('.column-pattern');
          // 有給チェック
          const yukyu = row.querySelector('.column-status');
          // 記入済みチェック
          const edited = row.querySelector('.column-attendance-type.attendance-text-align-center');
          const edit_button = row.querySelector('.column-edit a');
          return {
            kinmubi: kinmubi.innerText.includes('通常勤務'),
            yukyu: yukyu.innerText != '',
            edited: edited.innerText == '編',
            edit_url: edit_button.getAttribute('data-url'),
          }
        })
      })
  );

  for (const row of rows) {
    if (!row.kinmubi) continue;
    if (row.yukyu) continue;
    if (row.edited) continue;

    await page.click(`[data-url="${row.edit_url}"`);

    await editAttendanceForm(page);
    await page.waitFor(5000)
  }

  const shinseiButton = await page.$('.attendance-table-header-action a.attendance-button-primary#kt-attendance-approval-request-button');
  if (shinseiButton !== null) {
    await shinseiButton.click();
    await page.waitFor(2000);
    await page.click('input[name="commit"]');
    await page.waitFor(2000);
  } else {
    console.log(`勤怠承認申請ボタンがありません(${year}年${month}月分は申請済みではありませんか？)`)
  }

  await browser.close();
})();

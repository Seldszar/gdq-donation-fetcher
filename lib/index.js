const { createObjectCsvStringifier } = require("csv-writer");
const { parse } = require("date-fns");
const fs = require("fs");
const { JSDOM } = require("jsdom");
const { last, replace, toNumber, trim } = require("lodash");
const { isMatch } = require("matcher");
const { default: PQueue } = require("p-queue");
const { resolve } = require("url");

async function main(options) {
  const donations = new Map();
  const queue = new PQueue({
    intervalCap: 30,
    interval: 30000,
  });

  const fetchDonations = async (event, handler, page = 1) => {
    console.log("Fetching donation page %d...", page);

    const url = resolve(options.baseUrl, `donations/${event}?page=${page}`);
    const {
      window: {
        document: { body },
      },
    } = await queue.add(() => JSDOM.fromURL(url));

    for (const tr of body.querySelectorAll("tbody > tr")) {
      const [name, date, amount, comment] = tr.cells;
      const link = amount.querySelector("a");

      const donation = {
        id: toNumber(last(link.href.split("/"))),
        date: parse(trim(date.textContent)),
        url: trim(link.href),
        name: trim(name.textContent),
        amount: toNumber(replace(trim(amount.textContent), /[^0-9.-]+/g, "")),
      };

      if (trim(comment.textContent) === "Yes") {
        donation.comment = "";
      }

      if (isMatch(donation.name, options.donorPattern)) {
        handler(donation);
      }
    }

    const pageSelector = body.querySelector("#page");
    const currentPage = toNumber(pageSelector.value);
    const pageCount = toNumber(pageSelector.max);

    if (currentPage < pageCount) {
      await fetchDonations(event, handler, currentPage + 1);
    }
  };

  const fetchDonationComment = async id => {
    console.log("Fetching donation comment %d...", id);

    const url = resolve(options.baseUrl, `donation/${id}`);
    const {
      window: {
        document: { body },
      },
    } = await queue.add(() => JSDOM.fromURL(url));

    const el = body.querySelector("td");
    const text = trim(el.textContent);

    return text;
  };

  await fetchDonations(options.eventName, async donation => {
    if (donations.has(donation.id)) {
      return;
    }

    if (typeof donation.comment === "string") {
      const comment = await fetchDonationComment(donation.id);
      const pattern = /#\w+/g;
      const hashtags = [];

      let match;

      while ((match = pattern.exec(comment))) {
        hashtags.push(match[0]);
      }

      donation.comment = comment;
      donation.hashtags = hashtags;

      donations.set(donation.id, donation);
    }
  });

  const records = donations.values();
  const stringifier = createObjectCsvStringifier({
    header: ["id", "date", "url", "name", "amount", "comment", "hashtags"],
  })

  await queue.onIdle();
  await fs.promises.writeFile("donations.csv", stringifier.stringifyRecords(records));
}

module.exports = main;

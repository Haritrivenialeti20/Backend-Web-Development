'use strict';

const { Worker } = require('bullmq');
const { connection } = require('./queue');
const { transporter } = require('./email');

const worker = new Worker('email', async (job) => {
  if (job.name === 'otp') {
    const { to, otp } = job.data;
    await transporter.sendMail({
      to,
      subject: 'Your email verification code',
      text: `Your verification code is ${otp}. It expires in 10 minutes.`,
    });
    return;
  }

  throw new Error(`Unsupported email job: ${job.name}`);
}, {
  connection,
  // Job defaults are applied by the Queue; keep the retry policy explicit here too.
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
});

worker.on('completed', (job) => {
  console.log(`Email job ${job.id} (${job.name}) completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Email job ${job?.id ?? 'unknown'} failed: ${err.message}`);
});

module.exports = { worker };

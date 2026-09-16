const secret=process.env.CRON_SECRET?.trim();
if(!secret)throw new Error('CRON_SECRET is required from private runtime configuration');
const status=process.argv.includes('--status');
const response=await fetch(`https://cs35-scheduler.tuturuuu-e89.workers.dev/${status?'status':'start'}`,{
 method:status?'GET':'POST',headers:{authorization:`Bearer ${secret}`},
});
if(!response.ok)throw new Error(`Scheduler control failed (${response.status})`);
console.log(JSON.stringify(await response.json(),null,2));

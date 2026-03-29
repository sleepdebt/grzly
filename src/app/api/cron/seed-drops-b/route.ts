// Cron: seed-drops-b — second daily trigger for agent drop seeding
// Schedule: 30 18 * * 1-5 (6:30pm UTC, weekdays)
// Delegates entirely to seed-drops core logic.

export { GET } from '../seed-drops/route'

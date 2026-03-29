// Cron: seed-drops-c — third daily trigger for agent drop seeding
// Schedule: 0 21 * * 1-5 (9pm UTC / ~5pm ET, weekdays — near close)
// Delegates entirely to seed-drops core logic.

export { GET } from '../seed-drops/route'

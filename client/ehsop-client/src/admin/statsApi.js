import { api } from '../api.js'

// Admin only: Statistics, computed by the server on request (not live). Any write that changes
// money or stock (Orders, Restocks, Corrections, Cost prices) is picked up on the next visit.
export const statsApi = api.injectEndpoints({
  endpoints: (build) => ({
    statsMonth: build.query({ query: (month) => ({ url: 'stats/month/', params: month ? { month } : {} }), keepUnusedDataFor: 0 }),
    statsProducts: build.query({ query: (month) => ({ url: 'stats/products/', params: month ? { month } : {} }), keepUnusedDataFor: 0 }),
    statsHistory: build.query({ query: (month) => ({ url: 'stats/history/', params: month ? { month } : {} }), keepUnusedDataFor: 0 }),
    lowStock: build.query({ query: () => 'stats/low-stock/', keepUnusedDataFor: 0 }),
  }),
})

export const { useStatsMonthQuery, useStatsProductsQuery, useStatsHistoryQuery, useLowStockQuery } = statsApi

// This month in the shop's time zone, as YYYY-MM.
export const shopMonth = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit' }).format(new Date())

const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })
const monthShort = new Intl.DateTimeFormat('en-GB', { month: 'short' })
const toDate = (period) => new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)) - 1, 1)
export const formatMonth = (period) => monthName.format(toDate(period))
export const formatMonthShort = (period) => monthShort.format(toDate(period))

/**
 * How a figure moved since the previous month: { text, tone } where tone is good / bad / neutral.
 * `upIsGood` is false for Spent (buying more stock is neither good nor bad).
 */
export function change(current, previous, upIsGood = true) {
  const now = Number(current)
  const before = Number(previous)
  if (now === before) return { text: 'No change', tone: 'neutral' }
  if (before === 0) return { text: 'New this month', tone: upIsGood ? 'good' : 'neutral' }
  const percent = Math.round(((now - before) / Math.abs(before)) * 100)
  const up = now > before
  return {
    text: `${up ? '▲' : '▼'} ${Math.abs(percent)}%`,
    tone: upIsGood ? (up ? 'good' : 'bad') : 'neutral',
  }
}

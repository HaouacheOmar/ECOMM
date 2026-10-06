const dzd = new Intl.NumberFormat('fr-DZ', { maximumFractionDigits: 2 })

export const formatPrice = (price) => `${dzd.format(Number(price))} DA`

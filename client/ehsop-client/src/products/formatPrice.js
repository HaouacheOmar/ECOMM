const dzd = new Intl.NumberFormat('fr-DZ', { maximumFractionDigits: 2 })

// fr-DZ groups thousands with a narrow space (U+202F), which the tight letter-spacing swallows;
// a regular no-break space (U+00A0) keeps "11 500 DA" readable.
export const formatPrice = (price) => `${dzd.format(Number(price)).replace(/ /g, ' ')} DA`

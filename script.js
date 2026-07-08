(function() {
    'use strict';

    const CACHE_DURATION = 10000;
    let priceCache = {
        btc: { price: null, timestamp: 0 },
        usdt: { price: null, timestamp: 0 },
        usdc: { price: null, timestamp: 0 }
    };

    const fromCurrencySelect = document.getElementById('fromCurrency');
    const toCurrencySelect = document.getElementById('toCurrency');
    const amountInput = document.getElementById('amountInput');
    const feeInput = document.getElementById('feeInput');
    const resultValue = document.getElementById('resultValue');
    const resultLoading = document.getElementById('resultLoading');
    const swapBtn = document.getElementById('swapBtn');
    const refreshBtn = document.getElementById('refreshBtn');

    const btcPriceEl = document.getElementById('btcPrice');
    const usdtPriceEl = document.getElementById('usdtPrice');
    const usdcPriceEl = document.getElementById('usdcPrice');
    const btcStatusEl = document.getElementById('btcStatus');
    const usdtStatusEl = document.getElementById('usdtStatus');
    const usdcStatusEl = document.getElementById('usdcStatus');
    const updateDot = document.getElementById('updateDot');
    const updateText = document.getElementById('updateText');

    let isFetching = false;
    let fetchQueue = [];

    async function fetchTicker(symbol) {
        const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Erro ao buscar ${symbol}`);
        const data = await response.json();
        return parseFloat(data.price);
    }

    async function fetchAllPrices(force = false) {
        const now = Date.now();
        const needsFetch = {
            btc: force || (now - priceCache.btc.timestamp > CACHE_DURATION),
 usdt: force || (now - priceCache.usdt.timestamp > CACHE_DURATION),
 usdc: force || (now - priceCache.usdc.timestamp > CACHE_DURATION)
        };

        if (!needsFetch.btc && !needsFetch.usdt && !needsFetch.usdc) {
            return {
                btc: priceCache.btc.price,
                usdt: priceCache.usdt.price,
                usdc: priceCache.usdc.price
            };
        }

        if (isFetching) {
            return new Promise(resolve => {
                fetchQueue.push(resolve);
            });
        }

        isFetching = true;
        updateUIForLoading(true);

        try {
            const promises = [];
            if (needsFetch.btc) promises.push(fetchTicker('BTCBRL').then(p => ({ key: 'btc', price: p })).catch(() => ({ key: 'btc', price: null, error: true })));
            if (needsFetch.usdt) promises.push(fetchTicker('USDTBRL').then(p => ({ key: 'usdt', price: p })).catch(() => ({ key: 'usdt', price: null, error: true })));
            if (needsFetch.usdc) {
                promises.push(
                    fetchTicker('USDCBRL')
                    .then(p => ({ key: 'usdc', price: p }))
                    .catch(() => {
                        console.warn('USDC não encontrado, usando cotação do USDT como fallback');
                        return fetchTicker('USDTBRL').then(p => ({ key: 'usdc', price: p })).catch(() => ({ key: 'usdc', price: null, error: true }));
                    })
                );
            }

            const results = await Promise.all(promises);
            const nowDone = Date.now();
            results.forEach(result => {
                if (result.price !== null && !result.error) {
                    priceCache[result.key] = { price: result.price, timestamp: nowDone };
                }
            });

            if (priceCache.usdc.price === null && priceCache.usdt.price !== null) {
                priceCache.usdc = { price: priceCache.usdt.price, timestamp: priceCache.usdt.timestamp };
            }

            updatePriceDisplay();
            updateStatusIndicators();

            const dataToReturn = {
                btc: priceCache.btc.price,
                usdt: priceCache.usdt.price,
                usdc: priceCache.usdc.price
            };
            fetchQueue.forEach(resolve => resolve(dataToReturn));
            fetchQueue = [];
            return dataToReturn;
        } catch (err) {
            console.error('Erro crítico na busca de cotações:', err);
            updateStatusIndicators(true);
            return {
                btc: priceCache.btc.price,
                usdt: priceCache.usdt.price,
                usdc: priceCache.usdc.price
            };
        } finally {
            isFetching = false;
            updateUIForLoading(false);
        }
    }

    function updateUIForLoading(loading) {
        if (loading) {
            resultLoading.style.display = 'flex';
            updateDot.className = 'update-dot updating';
            updateText.textContent = 'Atualizando cotações...';
        } else {
            resultLoading.style.display = 'none';
            const allFresh = checkIfAllFresh();
            updateDot.className = allFresh ? 'update-dot fresh' : 'update-dot stale';
            updateText.textContent = allFresh ? 'Cotações atualizadas' : 'Usando cache';
        }
    }

    function checkIfAllFresh() {
        const now = Date.now();
        return (priceCache.btc.price && (now - priceCache.btc.timestamp < CACHE_DURATION)) &&
        (priceCache.usdt.price && (now - priceCache.usdt.timestamp < CACHE_DURATION)) &&
        (priceCache.usdc.price && (now - priceCache.usdc.timestamp < CACHE_DURATION));
    }

    function updatePriceDisplay() {
        btcPriceEl.textContent = priceCache.btc.price ? `R$ ${formatMoney(priceCache.btc.price)}` : 'R$ --';
        usdtPriceEl.textContent = priceCache.usdt.price ? `R$ ${formatMoney(priceCache.usdt.price)}` : 'R$ --';
        usdcPriceEl.textContent = priceCache.usdc.price ? `R$ ${formatMoney(priceCache.usdc.price)}` : 'R$ --';
    }

    function updateStatusIndicators(isError = false) {
        const now = Date.now();
        const setStatus = (element, price, timestamp) => {
            if (!price) element.className = 'rate-status error';
            else if ((now - timestamp) < CACHE_DURATION) element.className = 'rate-status success';
            else element.className = 'rate-status updating';
        };
            setStatus(btcStatusEl, priceCache.btc.price, priceCache.btc.timestamp);
            setStatus(usdtStatusEl, priceCache.usdt.price, priceCache.usdt.timestamp);
            setStatus(usdcStatusEl, priceCache.usdc.price, priceCache.usdc.timestamp);

            if (isError) {
                updateDot.className = 'update-dot offline';
                updateText.textContent = 'Erro ao atualizar';
            }
    }

    function getPriceForCurrency(currency) {
        switch(currency) {
            case 'BTC': return priceCache.btc.price;
            case 'Sats': return priceCache.btc.price ? priceCache.btc.price / 100000000 : null;
            case 'USDT': return priceCache.usdt.price;
            case 'USDC': return priceCache.usdc.price;
            case 'BRL': return 1;
            default: return null;
        }
    }

    function formatMoney(value) {
        if (value === null || value === undefined) return '0,00';
        if (Math.abs(value) < 0.01 && value !== 0) {
            return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 10 });
        }
        return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatCrypto(value, currency) {
        if (value === null || value === undefined) return '0';
        if (currency === 'Sats') {
            return Math.round(value).toLocaleString('pt-BR');
        }
        if (Math.abs(value) < 0.000001 && value !== 0) {
            return value.toFixed(10);
        }
        return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
    }

    function getFeeDecimal() {
        const fee = parseFloat(feeInput.value);
        if (isNaN(fee) || fee < 0) return 0;
        const cappedFee = Math.min(fee, 100);
        return cappedFee / 100;
    }

    async function performConversion() {
        const from = fromCurrencySelect.value;
        const to = toCurrencySelect.value;
        const inputStr = amountInput.value.replace(',', '.').trim();

        if (inputStr === '' || isNaN(parseFloat(inputStr))) {
            resultValue.textContent = to === 'BRL' ? 'R$ 0,00' : '0';
            return;
        }

        const amount = parseFloat(inputStr);
        if (amount === 0) {
            resultValue.textContent = to === 'BRL' ? 'R$ 0,00' : '0';
            return;
        }

        const prices = await fetchAllPrices();
        if (prices.btc === null && prices.usdt === null && prices.usdc === null) {
            resultValue.textContent = 'Erro nas cotações';
            updateStatusIndicators(true);
            return;
        }

        const fromPrice = getPriceForCurrency(from);
        const toPrice = getPriceForCurrency(to);

        if (fromPrice === null || toPrice === null) {
            resultValue.textContent = 'Cotação indisponível';
            return;
        }

        let valueInBrl;
        if (from === 'BRL') {
            valueInBrl = amount;
        } else {
            valueInBrl = amount * fromPrice;
        }

        let finalValue;
        if (to === 'BRL') {
            finalValue = valueInBrl;
        } else {
            finalValue = valueInBrl / toPrice;
        }

        const feeDecimal = getFeeDecimal();
        if (feeDecimal > 0) {
            finalValue = finalValue * (1 - feeDecimal);
        }

        if (to === 'BRL') {
            resultValue.textContent = `R$ ${formatMoney(finalValue)}`;
        } else if (to === 'Sats') {
            resultValue.textContent = `${formatCrypto(finalValue, 'Sats')} sats`;
        } else {
            resultValue.textContent = `${formatCrypto(finalValue, to)} ${to}`;
        }
    }

    function swapCurrencies() {
        const fromVal = fromCurrencySelect.value;
        const toVal = toCurrencySelect.value;
        fromCurrencySelect.value = toVal;
        toCurrencySelect.value = fromVal;
        performConversion();
    }

    function clearInput() {
        amountInput.value = '';
        resultValue.textContent = fromCurrencySelect.value === 'BRL' ? 'R$ 0,00' : '0';
        amountInput.focus();
    }

    fromCurrencySelect.addEventListener('change', performConversion);
    toCurrencySelect.addEventListener('change', performConversion);
    amountInput.addEventListener('input', performConversion);
    feeInput.addEventListener('input', performConversion);
    swapBtn.addEventListener('click', swapCurrencies);
    refreshBtn.addEventListener('click', () => fetchAllPrices(true));

    async function init() {
        updatePriceDisplay();
        updateStatusIndicators();
        await fetchAllPrices(true);
        performConversion();
    }

    init();

    setInterval(() => {
        const now = Date.now();
        if ((now - priceCache.btc.timestamp > CACHE_DURATION) ||
            (now - priceCache.usdt.timestamp > CACHE_DURATION) ||
            (now - priceCache.usdc.timestamp > CACHE_DURATION)) {
            fetchAllPrices();
            }
    }, 15000);

})();

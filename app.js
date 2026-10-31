(() => {
  const START_HOUR = 6;
  const END_HOUR = 24;
  const fleet = [
    { id: "EV-01", name: "Cargo Van 01", battery: 75, soc: 32, target: 90, depart: 12 },
    { id: "EV-02", name: "Cargo Van 02", battery: 64, soc: 48, target: 85, depart: 14 },
    { id: "EV-03", name: "Delivery 03", battery: 82, soc: 22, target: 90, depart: 16 },
    { id: "EV-04", name: "Delivery 04", battery: 60, soc: 55, target: 90, depart: 18 },
    { id: "EV-05", name: "Service Van 05", battery: 75, soc: 40, target: 95, depart: 20 },
    { id: "EV-06", name: "Service Van 06", battery: 90, soc: 25, target: 90, depart: 22 }
  ];
  const tariffs = {
    balanced: [0.18,0.17,0.16,0.16,0.17,0.20,0.22,0.21,0.18,0.13,0.10,0.08,0.07,0.08,0.11,0.15,0.20,0.24],
    solar:    [0.22,0.20,0.19,0.18,0.17,0.16,0.14,0.10,0.07,0.05,0.04,0.05,0.08,0.12,0.18,0.24,0.28,0.25],
    peak:     [0.13,0.12,0.12,0.13,0.16,0.21,0.25,0.27,0.24,0.18,0.14,0.12,0.11,0.13,0.17,0.23,0.30,0.32]
  };
  const body = document.getElementById("fleetBody");
  const scheduleBody = document.getElementById("scheduleBody");
  const emptyState = document.getElementById("emptyState");
  const departureOptions = [12,14,16,18,20,22,24];

  function hourLabel(hour) {
    return String(hour).padStart(2, "0") + ":00";
  }

  function renderFleet() {
    body.innerHTML = fleet.map((vehicle) => {
      const targetOptions = [80,85,90,95].map((value) =>
        '<option value="' + value + '"' + (value === vehicle.target ? " selected" : "") + '>' + value + '%</option>'
      ).join("");
      const departOptions = departureOptions.map((value) =>
        '<option value="' + value + '"' + (value === vehicle.depart ? " selected" : "") + '>' + hourLabel(value) + '</option>'
      ).join("");
      return '<tr data-id="' + vehicle.id + '">' +
        '<td class="vehicle-name"><span class="vehicle-icon">EV</span>' + vehicle.name + '</td>' +
        '<td class="battery-cell">' + vehicle.battery + ' kWh</td>' +
        '<td class="soc-cell"><input class="soc-control" type="range" min="0" max="95" step="1" value="' + vehicle.soc + '" data-soc aria-label="' + vehicle.name + ' current charge"><span class="soc-value" data-soc-value>' + vehicle.soc + '%</span></td>' +
        '<td><select class="target-select" data-target aria-label="' + vehicle.name + ' target charge">' + targetOptions + '</select></td>' +
        '<td><select class="depart-select" data-depart aria-label="' + vehicle.name + ' departure time">' + departOptions + '</select></td>' +
        '<td class="energy-cell" data-energy>—</td><td data-status><span class="status-pill">Waiting</span></td></tr>';
    }).join("");
  }

  function readFleetControls() {
    Array.from(body.querySelectorAll("tr")).forEach((row) => {
      const vehicle = fleet.find((item) => item.id === row.dataset.id);
      if (!vehicle) return;
      vehicle.soc = Number(row.querySelector("[data-soc]").value);
      vehicle.target = Number(row.querySelector("[data-target]").value);
      vehicle.depart = Number(row.querySelector("[data-depart]").value);
      row.querySelector("[data-soc-value]").textContent = vehicle.soc + "%";
    });
  }

  function getPrices() {
    return tariffs[document.getElementById("tariffProfile").value] || tariffs.balanced;
  }

  function renderPriceChart(prices) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const chart = document.getElementById("priceChart");
    chart.innerHTML = prices.map((price, index) => {
      const height = 22 + ((price - min) / Math.max(0.01, max - min)) * 67;
      let className = "price-bar";
      if (price === min) className += " is-cheapest";
      if (price === max) className += " is-expensive";
      return '<div class="' + className + '" style="height:' + height + '%" data-time="' + hourLabel(START_HOUR + index).slice(0,2) + '" title="' + hourLabel(START_HOUR + index) + ' · $' + price.toFixed(2) + '/kWh"></div>';
    }).join("");
  }

  function buildSlots(prices, chargerCount, chargerPower) {
    return prices.map((price, index) => ({
      hour: START_HOUR + index,
      price: price,
      baysLeft: chargerCount,
      power: chargerPower,
      sessions: []
    }));
  }

  function planVehicle(vehicle, slots) {
    const needed = Math.max(0, (vehicle.target - vehicle.soc) / 100 * vehicle.battery);
    let remaining = needed;
    const candidates = slots
      .filter((slot) => slot.hour < vehicle.depart && slot.baysLeft > 0)
      .sort((a, b) => a.price - b.price || a.hour - b.hour);
    for (const slot of candidates) {
      if (remaining <= 0.001) break;
      if (slot.baysLeft <= 0) continue;
      const energy = Math.min(remaining, slot.power);
      slot.baysLeft -= 1;
      slot.sessions.push({ id: vehicle.id, name: vehicle.name, energy: energy, price: slot.price, cost: energy * slot.price });
      remaining -= energy;
    }
    return { needed: needed, scheduled: needed - Math.max(0, remaining), shortfall: Math.max(0, remaining) };
  }

  function renderSchedule(slots, results, totalCost, totalEnergy, chargerCount) {
    const sessions = slots.flatMap((slot) => slot.sessions.map((session) => ({ hour: slot.hour, ...session })))
      .sort((a, b) => a.hour - b.hour || a.id.localeCompare(b.id));
    scheduleBody.innerHTML = sessions.map((session) =>
      '<tr><td class="time-cell">' + hourLabel(session.hour) + '</td><td>' + session.name + '</td><td>' + session.energy.toFixed(1) + ' kWh</td><td class="price-cell">$' + session.price.toFixed(2) + '</td><td class="cost-cell">$' + session.cost.toFixed(2) + '</td></tr>'
    ).join("");
    emptyState.classList.toggle("is-visible", sessions.length === 0);
    if (sessions.length === 0) scheduleBody.innerHTML = "";

    const ready = results.filter((result) => result.shortfall < 0.01).length;
    document.getElementById("statReady").textContent = ready + " / " + results.length;
    document.getElementById("statReadyNote").textContent = ready === results.length ? "All targets scheduled" : "Some departures need attention";
    document.getElementById("statEnergy").textContent = totalEnergy.toFixed(1) + " kWh";
    document.getElementById("statCost").textContent = "$" + totalCost.toFixed(2);
    document.getElementById("statHours").textContent = sessions.length;
    document.getElementById("statHoursNote").textContent = "of " + slots.length * chargerCount + " available bay-hours";
    const shortfallCount = results.filter((result) => result.shortfall >= 0.01).length;
    document.getElementById("scheduleSummary").textContent = sessions.length + " charging hours assigned · " + (shortfallCount ? shortfallCount + " vehicle target(s) remain unmet" : "all vehicle targets fit before departure");
  }

  function buildPlan() {
    readFleetControls();
    const chargerCount = Number(document.getElementById("chargerCount").value);
    const chargerPower = Number(document.getElementById("chargerPower").value);
    const prices = getPrices();
    renderPriceChart(prices);
    const slots = buildSlots(prices, chargerCount, chargerPower);
    const ordered = fleet.slice().sort((a, b) => a.depart - b.depart || a.id.localeCompare(b.id));
    const planned = new Map();
    ordered.forEach((vehicle) => planned.set(vehicle.id, planVehicle(vehicle, slots)));
    const results = fleet.map((vehicle) => planned.get(vehicle.id));
    const totalEnergy = results.reduce((sum, result) => sum + result.scheduled, 0);
    const totalCost = slots.reduce((sum, slot) => sum + slot.sessions.reduce((slotSum, session) => slotSum + session.cost, 0), 0);

    fleet.forEach((vehicle) => {
      const row = body.querySelector('tr[data-id="' + vehicle.id + '"]');
      const result = planned.get(vehicle.id);
      row.querySelector("[data-energy]").textContent = result.needed.toFixed(1) + " kWh";
      const status = row.querySelector("[data-status]");
      if (result.needed < 0.01) status.innerHTML = '<span class="status-pill">At target</span>';
      else if (result.shortfall < 0.01) status.innerHTML = '<span class="status-pill">On schedule</span>';
      else status.innerHTML = '<span class="status-pill warning">Short ' + result.shortfall.toFixed(1) + ' kWh</span>';
    });

    renderSchedule(slots, results, totalCost, totalEnergy, chargerCount);
  }

  body.addEventListener("input", (event) => {
    if (event.target.matches("[data-soc]")) event.target.nextElementSibling.textContent = event.target.value + "%";
  });
  body.addEventListener("change", buildPlan);
  document.getElementById("buildPlan").addEventListener("click", buildPlan);
  document.getElementById("tariffProfile").addEventListener("change", buildPlan);
  document.getElementById("chargerCount").addEventListener("input", (event) => {
    document.getElementById("chargerCountValue").textContent = event.target.value;
    buildPlan();
  });
  document.getElementById("chargerPower").addEventListener("input", (event) => {
    document.getElementById("chargerPowerValue").textContent = event.target.value;
    buildPlan();
  });

  renderFleet();
  buildPlan();
})();
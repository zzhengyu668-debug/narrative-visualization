/* global d3 */

const scenes = [
  {
    year: 1952,
    title: "A Divided World",
    copy: "The postwar world began from sharply different baselines. Income and life expectancy rose together, but most countries were still concentrated in the lower-left of the chart."
  },
  {
    year: 1982,
    title: "Global Progress",
    copy: "Thirty years later, the cloud had shifted upward. Many countries achieved much longer lives before their incomes fully caught up."
  },
  {
    year: 2007,
    title: "Healthier, but Still Unequal",
    copy: "By 2007, almost every region had moved toward longer lives. Yet the vertical gap between continents remained unmistakable."
  }
];

const continents = ["Africa", "Americas", "Asia", "Europe", "Oceania"];
const colors = new Map([
  ["Africa", "#e3654f"],
  ["Americas", "#208a80"],
  ["Asia", "#d49a21"],
  ["Europe", "#5368d6"],
  ["Oceania", "#8759b5"]
]);

const state = {
  currentScene: 0,
  selectedContinent: "All",
  hoveredCountry: null
};

const width = 1000;
const height = 620;
const margin = { top: 62, right: 42, bottom: 82, left: 92 };
const plotWidth = width - margin.left - margin.right;
const plotHeight = height - margin.top - margin.bottom;

const xScale = d3.scaleLog()
  .domain([250, 120000])
  .range([margin.left, width - margin.right]);

const yScale = d3.scaleLinear()
  .domain([20, 90])
  .range([height - margin.bottom, margin.top]);

const radiusScale = d3.scaleSqrt()
  .domain([200000, 1400000000])
  .range([3.2, 34]);

const formatIncome = d3.format("$,.0f");
const formatPopulation = d3.format(",.3~s");
const formatLife = d3.format(".1f");

const svg = d3.select("#chart");
const tooltip = d3.select("#tooltip");
const chartWrap = document.querySelector("#chart-wrap");

let allData = [];
let bubbleLayer;
let annotationLayer;

function buildChartFrame() {
  const defs = svg.append("defs");

  defs.append("marker")
    .attr("id", "annotation-arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 9)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#8e3d2c");

  svg.append("rect")
    .attr("class", "plot-background")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", plotWidth)
    .attr("height", plotHeight)
    .attr("rx", 5);

  const xTicks = [500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
  const yTicks = [30, 40, 50, 60, 70, 80, 90];

  svg.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(xScale).tickValues(xTicks).tickSize(-plotHeight).tickFormat(""));

  svg.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(yScale).tickValues(yTicks).tickSize(-plotWidth).tickFormat(""));

  svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(
      d3.axisBottom(xScale)
        .tickValues(xTicks)
        .tickSizeOuter(0)
        .tickFormat(d => `$${d3.format("~s")(d)}`)
    );

  svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(yScale).tickValues(yTicks).tickSizeOuter(0));

  svg.append("text")
    .attr("class", "axis-label")
    .attr("x", margin.left + plotWidth / 2)
    .attr("y", height - 24)
    .attr("text-anchor", "middle")
    .text("Income per person - GDP per capita (log scale)");

  svg.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -(margin.top + plotHeight / 2))
    .attr("y", 25)
    .attr("text-anchor", "middle")
    .text("Life expectancy (years)");

  const legend = svg.append("g")
    .attr("aria-label", "Continent color legend")
    .attr("transform", `translate(${margin.left + 4},25)`);

  legend.append("text")
    .attr("class", "legend-title")
    .attr("x", 0)
    .attr("y", 4)
    .text("Continent");

  const legendItems = legend.selectAll("g.legend-item")
    .data(continents)
    .join("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(${88 + i * 137},0)`);

  legendItems.append("circle")
    .attr("r", 5)
    .attr("fill", d => colors.get(d));

  legendItems.append("text")
    .attr("class", "legend-label")
    .attr("x", 10)
    .attr("y", 4)
    .text(d => d);

  bubbleLayer = svg.append("g").attr("class", "bubble-layer");
  annotationLayer = svg.append("g").attr("class", "annotation-layer").attr("pointer-events", "none");
}

function createNavigation() {
  d3.select("#progress")
    .selectAll("button")
    .data(scenes)
    .join("button")
    .attr("class", "progress-dot")
    .attr("type", "button")
    .attr("aria-label", (d, i) => `Go to scene ${i + 1}: ${d.title}`)
    .on("click", (event, d) => goToScene(scenes.indexOf(d)));

  d3.select("#previous").on("click", () => goToScene(state.currentScene - 1));
  d3.select("#next").on("click", () => goToScene(state.currentScene + 1));

  d3.select(window).on("keydown.story-navigation", event => {
    const activeTag = document.activeElement ? document.activeElement.tagName : "";
    if (["INPUT", "SELECT", "TEXTAREA"].includes(activeTag)) return;
    if (event.key === "ArrowLeft") goToScene(state.currentScene - 1);
    if (event.key === "ArrowRight") goToScene(state.currentScene + 1);
  });
}

function createContinentFilters() {
  const filterData = ["All", ...continents];
  const buttons = d3.select("#continent-filters")
    .selectAll("button")
    .data(filterData)
    .join("button")
    .attr("class", "filter-button")
    .attr("type", "button")
    .attr("aria-label", d => d === "All" ? "Show all continents" : `Highlight ${d}`)
    .on("click", (event, continent) => {
      state.selectedContinent = continent;
      updateFilterButtons();
      updateBubbles(false);
    });

  buttons.append("span")
    .attr("class", "filter-swatch")
    .style("--swatch", d => d === "All" ? "#899399" : colors.get(d));

  buttons.append("span").text(d => d);
  updateFilterButtons();
}

function updateFilterButtons() {
  d3.selectAll(".filter-button")
    .attr("aria-pressed", d => String(d === state.selectedContinent));
}

function goToScene(sceneIndex) {
  const nextIndex = Math.max(0, Math.min(scenes.length - 1, sceneIndex));
  if (nextIndex === state.currentScene && allData.length) return;

  state.currentScene = nextIndex;
  state.selectedContinent = "All";
  state.hoveredCountry = null;
  hideTooltip();
  renderScene();
}

function getSceneData() {
  const year = scenes[state.currentScene].year;
  return allData.filter(d => d.year === year).sort((a, b) => b.pop - a.pop);
}

function renderScene() {
  const scene = scenes[state.currentScene];
  const sceneData = getSceneData();

  d3.select("#scene-number").text(`${String(state.currentScene + 1).padStart(2, "0")} / 03`);
  d3.select("#scene-year").text(scene.year);
  d3.select("#scene-title").text(scene.title);
  d3.select("#scene-copy").text(scene.copy);

  d3.select("#previous").property("disabled", state.currentScene === 0);
  d3.select("#next").property("disabled", state.currentScene === scenes.length - 1);
  d3.selectAll(".progress-dot")
    .attr("aria-current", (d, i) => i === state.currentScene ? "step" : null);

  const explorePanel = document.querySelector("#explore-panel");
  explorePanel.hidden = state.currentScene !== scenes.length - 1;
  explorePanel.setAttribute("aria-hidden", String(explorePanel.hidden));
  updateFilterButtons();

  updateMetrics(sceneData);
  updateBubbles(true);
  updateAnnotation(sceneData);
}

function updateMetrics(sceneData) {
  const medianLife = d3.median(sceneData, d => d.lifeExp);
  const medianIncome = d3.median(sceneData, d => d.gdpPercap);

  d3.select("#metric-countries").text(sceneData.length);
  d3.select("#metric-life").text(`${formatLife(medianLife)} years`);
  d3.select("#metric-income").text(formatIncome(medianIncome));
}

function bubbleOpacity(d) {
  if (state.hoveredCountry === d.country) return 1;
  if (state.selectedContinent === "All") return 0.78;
  return d.continent === state.selectedContinent ? 0.96 : 0.07;
}

function updateBubbles(animate) {
  const sceneData = getSceneData();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = animate && !reduceMotion ? 820 : 220;

  const circles = bubbleLayer.selectAll("circle.country")
    .data(sceneData, d => d.country)
    .join(
      enter => enter.append("circle")
        .attr("class", "country")
        .attr("cx", d => xScale(d.gdpPercap))
        .attr("cy", d => yScale(d.lifeExp))
        .attr("r", 0)
        .attr("fill", d => colors.get(d.continent))
        .attr("stroke", "#fffefa")
        .attr("stroke-width", 1.2)
        .attr("opacity", 0),
      update => update,
      exit => exit.transition().duration(duration / 2).attr("r", 0).attr("opacity", 0).remove()
    )
    .attr("tabindex", 0)
    .attr("role", "img")
    .attr("aria-label", d => `${d.country}, ${d.year}: life expectancy ${formatLife(d.lifeExp)} years, income ${formatIncome(d.gdpPercap)}, population ${d3.format(",")(d.pop)}`)
    .on("pointerenter", handlePointerEnter)
    .on("pointermove", handlePointerMove)
    .on("pointerleave", handlePointerLeave)
    .on("focus", handleFocus)
    .on("blur", handlePointerLeave)
    .on("keydown", (event, d) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleFocus(event, d);
      }
    });

  circles.interrupt()
    .transition()
    .duration(duration)
    .ease(d3.easeCubicInOut)
    .attr("cx", d => xScale(d.gdpPercap))
    .attr("cy", d => yScale(d.lifeExp))
    .attr("r", d => radiusScale(d.pop))
    .attr("fill", d => colors.get(d.continent))
    .attr("opacity", bubbleOpacity);
}

function handlePointerEnter(event, d) {
  state.hoveredCountry = d.country;
  d3.select(event.currentTarget)
    .raise()
    .interrupt()
    .attr("stroke", "#172126")
    .attr("stroke-width", 2.4)
    .attr("opacity", 1);
  showTooltip(d);
  positionTooltip(event);
}

function handlePointerMove(event) {
  positionTooltip(event);
}

function handlePointerLeave(event) {
  state.hoveredCountry = null;
  d3.select(event.currentTarget)
    .interrupt()
    .attr("stroke", "#fffefa")
    .attr("stroke-width", 1.2)
    .attr("opacity", bubbleOpacity);
  hideTooltip();
}

function handleFocus(event, d) {
  state.hoveredCountry = d.country;
  d3.select(event.currentTarget)
    .raise()
    .attr("stroke", "#172126")
    .attr("stroke-width", 2.4)
    .attr("opacity", 1);
  showTooltip(d);

  const targetRect = event.currentTarget.getBoundingClientRect();
  const wrapRect = chartWrap.getBoundingClientRect();
  positionTooltipAt(targetRect.left - wrapRect.left + targetRect.width / 2, targetRect.top - wrapRect.top);
}

function showTooltip(d) {
  tooltip
    .html("")
    .attr("aria-hidden", "false")
    .classed("visible", true);

  tooltip.append("div").attr("class", "tooltip-country").text(`${d.country} · ${d.year}`);
  addTooltipRow("Life expectancy", `${formatLife(d.lifeExp)} years`);
  addTooltipRow("Income", formatIncome(d.gdpPercap));
  addTooltipRow("Population", d3.format(",")(d.pop));
  addTooltipRow("Continent", d.continent);
}

function addTooltipRow(label, value) {
  const row = tooltip.append("div").attr("class", "tooltip-row");
  row.append("span").text(label);
  row.append("strong").text(value);
}

function positionTooltip(event) {
  const [pointerX, pointerY] = d3.pointer(event, chartWrap);
  positionTooltipAt(pointerX, pointerY);
}

function positionTooltipAt(pointerX, pointerY) {
  const node = tooltip.node();
  const wrapWidth = chartWrap.clientWidth;
  const wrapHeight = chartWrap.clientHeight;
  const tooltipWidth = node.offsetWidth || 210;
  const tooltipHeight = node.offsetHeight || 130;

  let left = pointerX + 16;
  let top = pointerY - tooltipHeight - 12;

  if (left + tooltipWidth > wrapWidth - 8) left = pointerX - tooltipWidth - 16;
  if (top < 8) top = pointerY + 16;
  top = Math.min(top, wrapHeight - tooltipHeight - 8);

  tooltip.style("left", `${Math.max(8, left)}px`).style("top", `${Math.max(8, top)}px`);
}

function hideTooltip() {
  tooltip.classed("visible", false).attr("aria-hidden", "true");
}

function updateAnnotation(sceneData) {
  annotationLayer.selectAll("*").remove();

  // Keep the narrative text in a consistent, low-density corner so the
  // annotation remains visible without covering the main bubble cloud.
  const calloutBox = {
    boxX: margin.left + 16,
    boxY: margin.top + 14,
    boxWidth: 270
  };

  if (state.currentScene === 0) {
    const lowerLeft = sceneData.filter(d => d.gdpPercap < 2000 && d.lifeExp < 55);
    annotationLayer.append("rect")
      .attr("class", "annotation-region")
      .attr("x", xScale(250))
      .attr("y", yScale(55))
      .attr("width", xScale(2000) - xScale(250))
      .attr("height", yScale(20) - yScale(55))
      .attr("rx", 8);

    drawCallout({
      targetX: xScale(1150),
      targetY: yScale(47),
      ...calloutBox,
      title: "A divided starting point",
      body: `${lowerLeft.length} of ${sceneData.length} countries were below both $2,000 income and 55 years of life expectancy.`
    });
  }

  if (state.currentScene === 1) {
    const china = sceneData.find(d => d.country === "China");
    const china1952 = allData.find(d => d.country === "China" && d.year === 1952);
    const gain = china && china1952 ? china.lifeExp - china1952.lifeExp : 0;

    drawCallout({
      targetX: xScale(china.gdpPercap),
      targetY: yScale(china.lifeExp),
      ...calloutBox,
      title: "Longer lives came first",
      body: `China added ${formatLife(gain)} years of life expectancy since 1952 while income remained below $1,000 per person.`
    });
  }

  if (state.currentScene === 2) {
    const africa = sceneData.filter(d => d.continent === "Africa");
    const elsewhere = sceneData.filter(d => d.continent !== "Africa");
    const africaLife = d3.median(africa, d => d.lifeExp);
    const elsewhereLife = d3.median(elsewhere, d => d.lifeExp);
    const africaIncome = d3.median(africa, d => d.gdpPercap);

    drawCallout({
      targetX: xScale(africaIncome),
      targetY: yScale(africaLife),
      ...calloutBox,
      title: "The gap did not disappear",
      body: `Africa's median lifespan was ${formatLife(africaLife)} years, compared with ${formatLife(elsewhereLife)} years across the rest of the dataset.`
    });
  }

  annotationLayer.attr("opacity", 0)
    .transition()
    .delay(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 480)
    .duration(320)
    .attr("opacity", 1);
}

function drawCallout({ targetX, targetY, boxX, boxY, boxWidth, title, body }) {
  const boxHeight = 104;
  const boxOnRight = boxX > targetX;
  const lineStartX = boxOnRight ? boxX : boxX + boxWidth;
  const lineStartY = boxY + boxHeight * 0.58;
  const curveX = lineStartX + (targetX - lineStartX) * 0.52;

  annotationLayer.append("path")
    .attr("class", "annotation-link")
    .attr("d", `M${lineStartX},${lineStartY} C${curveX},${lineStartY} ${curveX},${targetY} ${targetX},${targetY}`)
    .attr("marker-end", "url(#annotation-arrow)");

  annotationLayer.append("circle")
    .attr("class", "annotation-target")
    .attr("cx", targetX)
    .attr("cy", targetY)
    .attr("r", 5);

  annotationLayer.append("rect")
    .attr("class", "annotation-box")
    .attr("x", boxX)
    .attr("y", boxY)
    .attr("width", boxWidth)
    .attr("height", boxHeight)
    .attr("rx", 12);

  annotationLayer.append("text")
    .attr("class", "annotation-title")
    .attr("x", boxX + 16)
    .attr("y", boxY + 27)
    .text(title);

  const bodyText = annotationLayer.append("text")
    .attr("class", "annotation-body")
    .attr("x", boxX + 16)
    .attr("y", boxY + 50);

  wrapSvgText(bodyText, body, boxWidth - 32, 17);
}

function wrapSvgText(textSelection, content, maxWidth, lineHeight) {
  const words = content.split(/\s+/).reverse();
  const x = textSelection.attr("x");
  const y = textSelection.attr("y");
  let word;
  let line = [];
  let lineNumber = 0;
  let tspan = textSelection.append("tspan").attr("x", x).attr("y", y);

  while ((word = words.pop())) {
    line.push(word);
    tspan.text(line.join(" "));
    if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
      line.pop();
      tspan.text(line.join(" "));
      line = [word];
      lineNumber += 1;
      tspan = textSelection.append("tspan")
        .attr("x", x)
        .attr("y", y)
        .attr("dy", lineNumber * lineHeight)
        .text(word);
    }
  }
}

function parseRow(d) {
  return {
    country: d.country,
    year: +d.year,
    pop: +d.pop,
    continent: d.continent,
    lifeExp: +d.lifeExp,
    gdpPercap: +d.gdpPercap
  };
}

buildChartFrame();
createNavigation();
createContinentFilters();

d3.csv("./data/gapminder.csv", parseRow)
  .then(data => {
    allData = data.filter(d => Number.isFinite(d.gdpPercap) && Number.isFinite(d.lifeExp));
    d3.select("#loading").remove();
    renderScene();
  })
  .catch(error => {
    console.error(error);
    d3.select("#loading")
      .classed("error", true)
      .text("The data could not be loaded. Please serve this folder through a local web server or GitHub Pages.");
  });

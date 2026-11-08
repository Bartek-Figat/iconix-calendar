/** Greedy lane packing for horizontal bars. Items need numeric s/e (e exclusive). Sets item.lane. */
export function packLanes(items) {
  items.sort((a, b) => a.s - b.s || (b.e - b.s) - (a.e - a.s));
  const ends = [];
  for (const it of items) {
    let l = ends.findIndex((x) => x <= it.s);
    if (l < 0) { l = ends.length; ends.push(0); }
    ends[l] = it.e;
    it.lane = l;
  }
  return ends.length;
}

/** Side-by-side columns for overlapping timed events in one day. Sets col/cols/span. */
export function packColumns(segs) {
  segs.sort((a, b) => a.s - b.s || b.e - a.e);
  let group = [];
  let groupEnd = -Infinity;
  const flush = () => {
    const cols = [];
    for (const g of group) {
      let c = cols.findIndex((end) => end <= g.s);
      if (c < 0) { c = cols.length; cols.push(0); }
      cols[c] = g.e;
      g.col = c;
    }
    for (const g of group) {
      g.cols = cols.length;
      // stretch to the right while neighbouring columns are free
      let span = 1;
      for (let c = g.col + 1; c < cols.length; c++) {
        if (group.some((o) => o.col === c && o.s < g.e && g.s < o.e)) break;
        span++;
      }
      g.span = span;
    }
    group = [];
  };
  for (const sg of segs) {
    if (sg.s >= groupEnd && group.length) { flush(); groupEnd = -Infinity; }
    group.push(sg);
    groupEnd = Math.max(groupEnd, sg.e);
  }
  if (group.length) flush();
  return segs;
}

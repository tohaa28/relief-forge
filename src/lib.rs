//! Polyline geometry in model millimetres. No Autodesk code or runtime dependency.
//! SVG curves must be explicitly flattened before they reach this initial kernel.
use std::cell::RefCell;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}
impl Point {
    pub fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }
    pub fn distance(self, p: Self) -> f64 {
        (self.x - p.x).hypot(self.y - p.y)
    }
    fn lerp(self, b: Self, t: f64) -> Self {
        Self::new(self.x + (b.x - self.x) * t, self.y + (b.y - self.y) * t)
    }
}
#[derive(Clone, Debug, PartialEq)]
pub struct Path {
    pub points: Vec<Point>,
    pub closed: bool,
}
impl Path {
    fn spans(&self) -> usize {
        self.points.len().saturating_sub(1) + usize::from(self.closed && self.points.len() > 1)
    }
    fn edge(&self, i: usize) -> (Point, Point) {
        (self.points[i], self.points[(i + 1) % self.points.len()])
    }
    pub fn area(&self) -> f64 {
        if !self.closed {
            return 0.0;
        }
        (0..self.spans())
            .map(|i| {
                let (a, b) = self.edge(i);
                a.x * b.y - b.x * a.y
            })
            .sum::<f64>()
            / 2.0
    }
    pub fn length(&self) -> f64 {
        (0..self.spans())
            .map(|i| {
                let (a, b) = self.edge(i);
                a.distance(b)
            })
            .sum()
    }
}
#[derive(Clone, Debug)]
pub struct Issue {
    pub kind: &'static str,
    pub path: usize,
    pub other: usize,
    pub a: usize,
    pub b: usize,
    pub point: Point,
}
fn cross(a: Point, b: Point) -> f64 {
    a.x * b.y - a.y * b.x
}
fn sub(a: Point, b: Point) -> Point {
    Point::new(a.x - b.x, a.y - b.y)
}

/// Non-parallel segment intersection, including endpoint contact. Scale-aware roundoff.
pub fn intersection(a: Point, b: Point, c: Point, d: Point) -> Option<(f64, f64, Point)> {
    let r = sub(b, a);
    let s = sub(d, c);
    let den = cross(r, s);
    if den.abs() <= f64::EPSILON * 32.0 * r.x.hypot(r.y) * s.x.hypot(s.y) {
        return None;
    }
    let t = cross(sub(c, a), s) / den;
    let u = cross(sub(c, a), r) / den;
    if (-1e-12..=1.0 + 1e-12).contains(&t) && (-1e-12..=1.0 + 1e-12).contains(&u) {
        Some((
            t.clamp(0.0, 1.0),
            u.clamp(0.0, 1.0),
            a.lerp(b, t.clamp(0.0, 1.0)),
        ))
    } else {
        None
    }
}
fn overlap(a: Point, b: Point, c: Point, d: Point, tol: f64) -> Option<Point> {
    let r = sub(b, a);
    let len = a.distance(b);
    if len <= 1e-12 {
        return None;
    }
    // Parallelism must not be inferred merely from a generous user tolerance.
    let s = sub(d, c);
    if cross(r, s).abs() > 1e-10 * len * c.distance(d) {
        return None;
    }
    if cross(r, sub(c, a)).abs() / len > tol || cross(r, sub(d, a)).abs() / len > tol {
        return None;
    }
    let project = |p: Point| ((p.x - a.x) * r.x + (p.y - a.y) * r.y) / (len * len);
    let t = project(c);
    let u = project(d);
    let lo = t.min(u).max(0.0);
    let hi = t.max(u).min(1.0);
    if (hi - lo) * len > tol {
        Some(a.lerp(b, (lo + hi) / 2.0))
    } else {
        None
    }
}
/// Duplicate closed paths are invariant to start-node rotation and direction.
pub fn duplicate(a: &Path, b: &Path, tol: f64) -> bool {
    let n = a.points.len();
    if a.closed != b.closed || n != b.points.len() || n == 0 {
        return false;
    }
    let starts: Vec<usize> = if a.closed {
        (0..n).collect()
    } else {
        vec![0, n - 1]
    };
    starts.into_iter().any(|start| {
        [-1isize, 1].into_iter().any(|dir| {
            if !a.closed && !((start == 0 && dir == 1) || (start == n - 1 && dir == -1)) {
                return false;
            }
            (0..n).all(|i| {
                let j = (start as isize + dir * i as isize).rem_euclid(n as isize) as usize;
                a.points[i].distance(b.points[j]) <= tol
            })
        })
    })
}
// Conservative broad phase only: retain the original exact predicates and issue order.
fn near_points(a: Point, b: Point, tol: f64) -> bool {
    (a.x-b.x).abs() <= tol && (a.y-b.y).abs() <= tol && a.distance(b) <= tol
}
fn edge_boxes_meet(a: Point, b: Point, c: Point, d: Point, tol: f64) -> bool {
    // intersection() accepts a 1e-12 parametric endpoint extension. Include
    // both edge lengths so rejecting a box cannot discard that contact.
    let pad = tol.max(1e-12 * ((a.x-b.x).abs() + (a.y-b.y).abs() + (c.x-d.x).abs() + (c.y-d.y).abs())) + 1e-12;
    a.x.min(b.x) <= c.x.max(d.x)+pad && c.x.min(d.x) <= a.x.max(b.x)+pad
        && a.y.min(b.y) <= c.y.max(d.y)+pad && c.y.min(d.y) <= a.y.max(b.y)+pad
}
pub fn diagnose(paths: &[Path], tol: f64) -> Vec<Issue> {
    let mut out = Vec::new();
    macro_rules! emit {
        ($issue:expr) => {{
            if out.len() >= 10000 {
                return out;
            }
            out.push($issue);
        }};
    }
    for (i, p) in paths.iter().enumerate() {
        if p.points.is_empty() {
            continue;
        }
        if !p.closed {
            emit!(Issue {
                kind: "open",
                path: i,
                other: i,
                a: 0,
                b: p.points.len() - 1,
                point: p.points[0]
            });
        }
        for a in 0..p.points.len() {
            for b in a + 1..p.points.len() {
                if near_points(p.points[a], p.points[b], tol) {
                    emit!(Issue {
                        kind: "coincident",
                        path: i,
                        other: i,
                        a,
                        b,
                        point: p.points[a]
                    });
                }
            }
        }
        for a in 0..p.spans() {
            let (x, y) = p.edge(a);
            if x.distance(y) <= tol {
                emit!(Issue {
                    kind: "short",
                    path: i,
                    other: i,
                    a,
                    b: a,
                    point: x.lerp(y, 0.5)
                });
            }
        }
        for (j, q) in paths.iter().enumerate().skip(i) {
            if i != j {
                if duplicate(p, q, tol) {
                    emit!(Issue {
                        kind: "duplicate",
                        path: j,
                        other: i,
                        a: 0,
                        b: 0,
                        point: q.points[0]
                    });
                }
                for a in 0..p.points.len() {
                    for b in 0..q.points.len() {
                        if near_points(p.points[a], q.points[b], tol) {
                            emit!(Issue {
                                kind: "coincident",
                                path: i,
                                other: j,
                                a,
                                b,
                                point: p.points[a]
                            });
                        }
                    }
                }
            }
            for a in 0..p.spans() {
                for b in 0..q.spans() {
                    if i == j && b <= a {
                        continue;
                    }
                    let (x, y) = p.edge(a);
                    let (v, w) = q.edge(b);
                    if !edge_boxes_meet(x, y, v, w, tol) { continue; }
                    // Adjacent backtracking spans still need overlap detection.
                    if let Some(point) = overlap(x, y, v, w, tol) {
                        emit!(Issue {
                            kind: "overlap",
                            path: i,
                            other: j,
                            a,
                            b,
                            point
                        });
                        continue;
                    }
                    if i == j && (b == a + 1 || (p.closed && a == 0 && b == p.spans() - 1)) {
                        continue;
                    }
                    if let Some((_, _, point)) = intersection(x, y, v, w) {
                        emit!(Issue {
                            kind: if i == j {
                                "self_intersection"
                            } else {
                                "intersection"
                            },
                            path: i,
                            other: j,
                            a,
                            b,
                            point
                        });
                    }
                }
            }
        }
    }
    out
}
pub fn remove_duplicates(paths: &[Path], tol: f64) -> Vec<Path> {
    let mut out: Vec<Path> = Vec::new();
    for p in paths {
        if !out.iter().any(|q| duplicate(p, q, tol)) {
            out.push(p.clone());
        }
    }
    out
}
pub fn clean_nodes(paths: &[Path], tol: f64) -> Vec<Path> {
    paths
        .iter()
        .map(|p| {
            let mut points: Vec<Point> = Vec::new();
            for x in &p.points {
                if points.last().map_or(true, |q| q.distance(*x) > tol) {
                    points.push(*x);
                }
            }
            if p.closed && points.len() > 1 && points[0].distance(*points.last().unwrap()) <= tol {
                points.pop();
            }
            Path {
                points,
                closed: p.closed,
            }
        })
        .collect()
}
/// Join only mutually unique endpoint candidates; never guess at a branch.
pub fn join(paths: &[Path], tol: f64) -> Vec<Path> {
    let mut out = paths.to_vec();
    loop {
        let mut ends: Vec<(usize, bool, Point)> = Vec::new();
        for (i, p) in out.iter().enumerate() {
            if !p.closed && p.points.len() >= 2 {
                ends.push((i, false, p.points[0]));
                ends.push((i, true, *p.points.last().unwrap()));
            }
        }
        let mut pairs = Vec::new();
        for a in 0..ends.len() {
            for b in a + 1..ends.len() {
                if ends[a].0 != ends[b].0 && ends[a].2.distance(ends[b].2) <= tol {
                    pairs.push((a, b));
                }
            }
        }
        let candidate = pairs.iter().copied().find(|(a, b)| {
            pairs.iter().filter(|(x, y)| x == a || y == a).count() == 1
                && pairs.iter().filter(|(x, y)| x == b || y == b).count() == 1
        });
        let Some((a, b)) = candidate else {
            break;
        };
        let (i, tail, _) = ends[a];
        let (j, tail2, _) = ends[b];
        let mut p = out[i].clone();
        let mut q = out[j].clone();
        if !tail {
            p.points.reverse();
        }
        if tail2 {
            q.points.reverse();
        }
        let midpoint = p.points.last().unwrap().lerp(q.points[0], 0.5);
        *p.points.last_mut().unwrap() = midpoint;
        q.points[0] = midpoint;
        p.points.extend(q.points.into_iter().skip(1));
        out[i] = p;
        out.remove(j); // endpoint enumeration guarantees i < j
    }
    out
}
pub fn close_near(paths: &[Path], tol: f64) -> Vec<Path> {
    paths
        .iter()
        .map(|p| {
            let mut p = p.clone();
            if !p.closed
                && p.points.len() >= 3
                && p.points[0].distance(*p.points.last().unwrap()) <= tol
            {
                let last = p.points.pop().unwrap();
                p.points[0] = p.points[0].lerp(last, 0.5);
                p.closed = true;
            }
            p
        })
        .collect()
}
fn point_segment(p: Point, a: Point, b: Point) -> f64 {
    let r = sub(b, a);
    let den = r.x * r.x + r.y * r.y;
    if den == 0.0 {
        return p.distance(a);
    }
    p.distance(a.lerp(
        b,
        (((p.x - a.x) * r.x + (p.y - a.y) * r.y) / den).clamp(0.0, 1.0),
    ))
}
fn rdp(points: &[Point], tol: f64) -> Vec<Point> {
    if points.len() < 3 {
        return points.to_vec();
    }
    let mut best = (0, 0.0);
    for (i, p) in points.iter().enumerate().take(points.len() - 1).skip(1) {
        let d = point_segment(*p, points[0], *points.last().unwrap());
        if d > best.1 {
            best = (i, d)
        }
    }
    if best.1 <= tol {
        vec![points[0], *points.last().unwrap()]
    } else {
        let mut a = rdp(&points[..=best.0], tol);
        a.pop();
        a.extend(rdp(&points[best.0..], tol));
        a
    }
}
/// Initial simplifier is restricted to open polylines; closed topology is retained.
pub fn simplify(paths: &[Path], tol: f64) -> Vec<Path> {
    paths
        .iter()
        .map(|p| {
            if p.closed {
                p.clone()
            } else {
                Path {
                    points: rdp(&p.points, tol),
                    closed: false,
                }
            }
        })
        .collect()
}

/// Split non-collinear intersections into independent spans/chains; collinear overlaps remain diagnostics.
pub fn split_intersections(paths: &[Path]) -> Result<Vec<Path>, String> {
    let mut cuts: Vec<Vec<Vec<f64>>> = paths
        .iter()
        .map(|p| (0..p.spans()).map(|_| vec![0.0, 1.0]).collect())
        .collect();
    for (i, p) in paths.iter().enumerate() {
        for (j, q) in paths.iter().enumerate().skip(i) {
            for a in 0..p.spans() {
                for b in 0..q.spans() {
                    if i == j
                        && (b <= a || b == a + 1 || (p.closed && a == 0 && b == p.spans() - 1))
                    {
                        continue;
                    }
                    let (x, y) = p.edge(a);
                    let (v, w) = q.edge(b);
                    if let Some((t, u, _)) = intersection(x, y, v, w) {
                        cuts[i][a].push(t);
                        cuts[j][b].push(u);
                    }
                }
            }
        }
    }
    let mut out = Vec::new();
    for (i, p) in paths.iter().enumerate() {
        // Emit atomic spans explicitly; joining is a separate operation.
        for a in 0..p.spans() {
            let (x, y) = p.edge(a);
            let ts = &mut cuts[i][a];
            ts.sort_by(f64::total_cmp);
            ts.dedup_by(|a, b| (*a - *b).abs() < 1e-12);
            for ts in ts.windows(2) {
                if x.distance(y) * (ts[1] - ts[0]) > 1e-12 {
                    if out.len() >= 1000 {
                        return Err("Split exceeds the 2000-node alpha limit".into());
                    }
                    out.push(Path {
                        points: vec![x.lerp(y, ts[0]), x.lerp(y, ts[1])],
                        closed: false,
                    });
                }
            }
        }
        if p.spans() == 0 {
            out.push(p.clone());
        }
    }
    Ok(out)
}

/// Decompose proper self crossings without crossing between separate paths.
/// The keep threshold is relative to total absolute area of the extracted cycles.
/// This definition is explicit and is NOT yet verified against ArtCAM's area semantics.
pub fn extract_loops(paths: &[Path], keep_percent: f64) -> Vec<Path> {
    fn decompose(p: Path, depth: usize, out: &mut Vec<Path>) {
        if depth >= 256 {
            out.push(p);
            return;
        }
        for a in 0..p.spans() {
            for b in a + 2..p.spans() {
                if p.closed && a == 0 && b == p.spans() - 1 {
                    continue;
                }
                let (x, y) = p.edge(a);
                let (v, w) = p.edge(b);
                if let Some((t, u, pt)) = intersection(x, y, v, w) {
                    if t <= 1e-10 || t >= 1.0 - 1e-10 || u <= 1e-10 || u >= 1.0 - 1e-10 {
                        continue;
                    }
                    let mut cycle = vec![pt];
                    cycle.extend_from_slice(&p.points[a + 1..=b]);
                    let mut rest = p.points[..=a].to_vec();
                    rest.push(pt);
                    rest.extend_from_slice(&p.points[b + 1..]);
                    decompose(
                        Path {
                            points: cycle,
                            closed: true,
                        },
                        depth + 1,
                        out,
                    );
                    decompose(
                        Path {
                            points: rest,
                            closed: p.closed,
                        },
                        depth + 1,
                        out,
                    );
                    return;
                }
            }
        }
        out.push(p)
    }
    let mut result = Vec::new();
    for p in paths {
        let mut parts = Vec::new();
        decompose(p.clone(), 0, &mut parts);
        let total = parts.iter().map(|p| p.area().abs()).sum::<f64>();
        result.extend(parts.into_iter().filter(|p| {
            !p.closed || total == 0.0 || p.area().abs() / total * 100.0 >= keep_percent
        }));
    }
    result
}

/// Packed f64 ABI: tolerance, action, parameter, path_count, [closed, node_count, x,y...].
pub fn process(input: &[f64]) -> Result<String, String> {
    if input.len() < 4 || input.iter().any(|x| !x.is_finite() || x.abs() > 1e9) {
        return Err("Invalid or non-finite input".into());
    }
    let tol = input[0];
    if !(1e-9..=1000.0).contains(&tol) {
        return Err("Tolerance must be 1e-9..1000 mm".into());
    }
    let integer = |n: f64, max: usize| -> Result<usize, String> {
        if n < 0.0 || n.fract() != 0.0 || n > max as f64 {
            Err("Invalid count/action".into())
        } else {
            Ok(n as usize)
        }
    };
    let action = integer(input[1], 8)?;
    let count = integer(input[3], 2000)?;
    let mut at = 4;
    let mut paths = Vec::new();
    let mut total = 0;
    for _ in 0..count {
        if at + 2 > input.len() {
            return Err("Truncated path".into());
        }
        let closed = integer(input[at], 1)? == 1;
        let n = integer(input[at + 1], 2000)?;
        total += n;
        if total > 2000 {
            return Err("Alpha kernel limit: 2000 nodes".into());
        }
        at += 2;
        if at + 2 * n > input.len() {
            return Err("Truncated nodes".into());
        }
        let points = input[at..at + 2 * n]
            .chunks_exact(2)
            .map(|v| Point::new(v[0], v[1]))
            .collect();
        at += 2 * n;
        paths.push(Path { points, closed });
    }
    if at != input.len() {
        return Err("Trailing input".into());
    }
    let paths = match action {
        0 => paths,
        1 => remove_duplicates(&paths, tol),
        2 => clean_nodes(&paths, tol),
        3 => join(&paths, tol),
        4 => close_near(&paths, tol),
        5 => {
            for p in &mut paths {
                p.points.reverse()
            }
            paths
        }
        6 => simplify(&paths, tol),
        7 => split_intersections(&paths)?,
        8 => {
            if !(0.0..=100.0).contains(&input[2]) {
                return Err("Loop threshold must be 0..100%".into());
            }
            extract_loops(&paths, input[2])
        }
        _ => unreachable!(),
    };
    if paths.iter().map(|p| p.points.len()).sum::<usize>() > 2000 {
        return Err("Result exceeds the 2000-node alpha limit".into());
    }
    // Diagnostic complexity is quadratic in this initial implementation.
    let issues = diagnose(&paths, tol);
    let mut s = String::from("{\"paths\":[");
    for (i, p) in paths.iter().enumerate() {
        if i > 0 {
            s.push(',')
        }
        s.push_str(&format!(
            "{{\"closed\":{},\"area\":{},\"length\":{},\"points\":[",
            p.closed,
            p.area(),
            p.length()
        ));
        for (j, x) in p.points.iter().enumerate() {
            if j > 0 {
                s.push(',')
            }
            s.push_str(&format!("[{},{}]", x.x, x.y))
        }
        s.push_str("]}");
    }
    s.push_str("],\"issues\":[");
    for (i, x) in issues.iter().enumerate() {
        if i > 0 {
            s.push(',')
        }
        s.push_str(&format!(
            "{{\"kind\":\"{}\",\"path\":{},\"other\":{},\"a\":{},\"b\":{},\"point\":[{},{}]}}",
            x.kind, x.path, x.other, x.a, x.b, x.point.x, x.point.y
        ));
    }
    s.push_str(&format!(
        "],\"diagnosticComplete\":{}}}",
        issues.len() < 10000
    ));
    Ok(s)
}
thread_local! {static OUTPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };}
#[no_mangle]
pub extern "C" fn input_alloc(len: usize) -> *mut f64 {
    let mut v = vec![0.0; len];
    let p = v.as_mut_ptr();
    std::mem::forget(v);
    p
}
/// # Safety
/// ptr must be from input_alloc(len), live, and consumed exactly once.
#[no_mangle]
pub unsafe extern "C" fn run(ptr: *mut f64, len: usize) -> i32 {
    let v = Vec::from_raw_parts(ptr, len, len);
    let result = process(&v);
    let code = if result.is_ok() { 0 } else { 1 };
    let text = match result {
        Ok(s) => s,
        Err(e) => format!("{{\"error\":\"{}\"}}", e),
    };
    OUTPUT.with(|o| *o.borrow_mut() = text.into_bytes());
    code
}
#[no_mangle]
pub extern "C" fn result_ptr() -> *const u8 {
    OUTPUT.with(|o| o.borrow().as_ptr())
}
#[no_mangle]
pub extern "C" fn result_len() -> usize {
    OUTPUT.with(|o| o.borrow().len())
}

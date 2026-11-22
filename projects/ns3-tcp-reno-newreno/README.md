# TCP Reno vs NewReno Congestion Control in ns-3 (Course Project)

**Course:** CPSC 4317 Computer Networks, Lamar University, Fall 2026
**Team:** 3 students (group project)
**Tools:** ns-3.45 network simulator, C++, Python (matplotlib), Ubuntu Linux, GitHub Codespaces

## Overview
We used the ns-3 discrete-event network simulator to study how TCP congestion control behaves over a bottleneck link. A C++ simulation program (`tcp-cwnd.cc`) builds a point-to-point topology, runs a bulk TCP transfer, traces the congestion window (cwnd) over time and reports throughput and delay. A Python script turns the traces into figures.

## Experiments
1. **TCP NewReno baseline** – traced cwnd and identified slow start, congestion avoidance and fast recovery phases.
2. **Reno vs NewReno** – ran both algorithms under identical settings and compared cwnd behaviour and throughput. NewReno reached about **9.92 Mbps** versus about **9.45 Mbps** for Reno, because NewReno recovers from multiple losses in one window without waiting for a timeout.
3. **Buffer-size sensitivity** – varied the bottleneck queue size and measured the effect on throughput and queuing delay for both algorithms.

## My contributions
- Wrote and debugged the C++ simulation program and the plotting script
- Found that two experiments had used different SACK settings, which made Reno look far worse than it was (about 2 Mbps). I re-ran all cases with the same settings so the comparison was fair
- Built and ran ns-3 on Ubuntu in GitHub Codespaces and documented how to reproduce the results
- Co-wrote the project report

## Reproduce
```bash
# inside ns-allinone-3.45/ns-3.45
./ns3 configure --enable-examples
./ns3 build
cp tcp-cwnd.cc scratch/
./ns3 run scratch/tcp-cwnd
```

## Files
| File | Description |
|---|---|
| `tcp-cwnd.cc` | ns-3 simulation program *(add from the course submission)* |
| `make_figures.py` | Plot script *(add from the course submission)* |
| `images/` | cwnd and throughput figures |

> **Before publishing:** copy `tcp-cwnd.cc`, `make_figures.py` and the figures (`fig1_part1_cwnd.png`, `fig2_part2_overlay.png`, `fig3_part3_cwnd.png`, `fig4_part3_throughput_delay.png`) from the course submission into this folder. Delete this note afterwards.

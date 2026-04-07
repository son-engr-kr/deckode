"""
Generate RL-related plots for Deckode test presentation.
Output: public/assets/rl/*.png  (960x540 @96dpi = 10x5.625 inches)
"""
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from pathlib import Path

OUT = Path(__file__).parent.parent / "public" / "assets" / "rl"
OUT.mkdir(parents=True, exist_ok=True)

FIG_W, FIG_H = 8, 4.5   # inches → ~960x540 at 120dpi
DPI = 120

COLORS = {
    "blue":   "#2c5282",
    "teal":   "#2b6cb0",
    "green":  "#276749",
    "red":    "#c53030",
    "gray":   "#718096",
    "bg":     "#f8fafc",
    "accent": "#4299e1",
}

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "axes.spines.top":   False,
    "axes.spines.right": False,
    "axes.facecolor":    COLORS["bg"],
    "figure.facecolor":  "white",
    "axes.edgecolor":    "#cbd5e0",
    "axes.labelcolor":   "#2d3748",
    "xtick.color":       "#4a5568",
    "ytick.color":       "#4a5568",
    "grid.color":        "#e2e8f0",
    "grid.linestyle":    "--",
    "grid.linewidth":    0.6,
})

# ── 1. Q-Learning convergence curve ──────────────────────────────────────────
rng = np.random.default_rng(42)
episodes = np.arange(1, 501)

def learning_curve(eps, noise=0.15, tau=80, final=1.0, start=-0.3):
    base = final - (final - start) * np.exp(-eps / tau)
    return base + rng.normal(0, noise * np.exp(-eps / 200), len(eps))

qlearn = learning_curve(episodes, noise=0.18, tau=70)
sarsa  = learning_curve(episodes, noise=0.14, tau=90, final=0.92)
dqn    = learning_curve(episodes, noise=0.10, tau=50, final=1.05, start=-0.5)

fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
ax.plot(episodes, qlearn, color=COLORS["blue"],   lw=1.8, alpha=0.85, label="Q-Learning")
ax.plot(episodes, sarsa,  color=COLORS["green"],  lw=1.8, alpha=0.85, label="SARSA")
ax.plot(episodes, dqn,    color=COLORS["accent"], lw=1.8, alpha=0.85, label="DQN")
# smooth trend
for arr, c in [(qlearn, COLORS["blue"]), (sarsa, COLORS["green"]), (dqn, COLORS["accent"])]:
    kernel = np.ones(30) / 30
    smooth = np.convolve(arr, kernel, mode="same")
    ax.plot(episodes[15:-14], smooth[15:-14], color=c, lw=2.8, alpha=1.0)

ax.set_xlabel("Episode", fontsize=11)
ax.set_ylabel("Cumulative Reward", fontsize=11)
ax.set_title("RL Algorithm Convergence", fontsize=13, fontweight="bold", color=COLORS["blue"])
ax.legend(fontsize=10, framealpha=0.8)
ax.grid(True)
ax.set_xlim(1, 500)
plt.tight_layout()
plt.savefig(OUT / "convergence.png", dpi=DPI, bbox_inches="tight")
plt.close()
print("OK convergence.png")

# ── 2. Value function heatmap (5×5 grid world) ───────────────────────────────
V = np.array([
    [0.10, 0.18, 0.28, 0.38, 0.52],
    [0.15, 0.00, 0.00, 0.48, 0.64],   # 0.0 = obstacles
    [0.22, 0.30, 0.38, 0.58, 0.78],
    [0.30, 0.00, 0.00, 0.70, 0.88],
    [0.38, 0.45, 0.55, 0.80, 1.00],   # (4,4) = goal
])
OBSTACLE = V == 0.0

fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
masked = np.ma.array(V, mask=OBSTACLE)
cmap = plt.cm.YlOrRd
cmap.set_bad(color="#718096")
im = ax.imshow(masked, cmap=cmap, vmin=0, vmax=1)
plt.colorbar(im, ax=ax, label="$V^*(s)$", fraction=0.035)

for i in range(5):
    for j in range(5):
        if OBSTACLE[i, j]:
            ax.text(j, i, "✕", ha="center", va="center", fontsize=14, color="white")
        else:
            ax.text(j, i, f"{V[i,j]:.2f}", ha="center", va="center",
                    fontsize=10, color="black" if V[i,j] < 0.7 else "white")

# Mark start and goal
ax.add_patch(mpatches.Rectangle((-0.5, -0.5), 1, 1, fill=False, edgecolor=COLORS["teal"], lw=3))
ax.add_patch(mpatches.Rectangle((3.5, 3.5), 1, 1, fill=False, edgecolor=COLORS["green"], lw=3))
ax.text(0, 0, "S", ha="center", va="center", fontsize=11, fontweight="bold", color=COLORS["teal"])
ax.text(4, 4, "G", ha="center", va="center", fontsize=11, fontweight="bold", color=COLORS["green"])

ax.set_xticks(range(5)); ax.set_yticks(range(5))
ax.set_xticklabels([f"$s_{{*{j}}}$" for j in range(5)], fontsize=9)
ax.set_yticklabels([f"$s_{{{i}*}}$" for i in range(5)], fontsize=9)
ax.set_title("Optimal Value Function $V^*(s)$ — Grid World", fontsize=12,
             fontweight="bold", color=COLORS["blue"])
plt.tight_layout()
plt.savefig(OUT / "value-heatmap.png", dpi=DPI, bbox_inches="tight")
plt.close()
print("OK value-heatmap.png")

# ── 3. Policy gradient loss curve ────────────────────────────────────────────
steps = np.arange(1, 1001)
pg_loss   = 2.5 * np.exp(-steps / 300) + 0.3 + rng.normal(0, 0.05, 1000)
ppo_loss  = 2.5 * np.exp(-steps / 200) + 0.2 + rng.normal(0, 0.04, 1000)
entropy   = 1.8 * np.exp(-steps / 400) + rng.normal(0, 0.03, 1000)

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(FIG_W, FIG_H))

k = np.ones(40) / 40
for arr, c, lbl, ax in [
    (pg_loss,  COLORS["red"],    "REINFORCE",  ax1),
    (ppo_loss, COLORS["accent"], "PPO",        ax1),
]:
    ax.plot(steps, arr, color=c, lw=0.8, alpha=0.3)
    ax.plot(steps[20:-19], np.convolve(arr, k, "same")[20:-19], color=c, lw=2.2, label=lbl)

ax1.set_xlabel("Training Steps", fontsize=10)
ax1.set_ylabel("Policy Loss", fontsize=10)
ax1.set_title("Policy Loss", fontsize=11, fontweight="bold", color=COLORS["blue"])
ax1.legend(fontsize=9); ax1.grid(True)

ax2.plot(steps, entropy, color=COLORS["gray"], lw=0.8, alpha=0.3)
ax2.plot(steps[20:-19], np.convolve(entropy, k, "same")[20:-19],
         color=COLORS["gray"], lw=2.2)
ax2.set_xlabel("Training Steps", fontsize=10)
ax2.set_ylabel("Entropy", fontsize=10)
ax2.set_title("Policy Entropy", fontsize=11, fontweight="bold", color=COLORS["blue"])
ax2.grid(True)

fig.suptitle("Policy Gradient Training Dynamics", fontsize=12,
             fontweight="bold", color=COLORS["blue"], y=1.01)
plt.tight_layout()
plt.savefig(OUT / "policy-gradient.png", dpi=DPI, bbox_inches="tight")
plt.close()
print("OK policy-gradient.png")

# ── 4. Q-table evolution (bar chart) ─────────────────────────────────────────
actions = ["↑ Up", "↓ Down", "← Left", "→ Right"]
q_init  = [0.0, 0.0, 0.0, 0.0]
q_mid   = [0.12, -0.05, 0.08, 0.35]
q_final = [0.18, -0.12, 0.22, 0.82]

x = np.arange(len(actions))
w = 0.25

fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
ax.bar(x - w,   q_init,  w, label="Init (ep=0)",   color=COLORS["gray"],   alpha=0.7)
ax.bar(x,       q_mid,   w, label="Mid (ep=100)",  color=COLORS["teal"],   alpha=0.8)
ax.bar(x + w,   q_final, w, label="Final (ep=500)",color=COLORS["accent"], alpha=0.9)
ax.axhline(0, color="#4a5568", lw=0.8)
ax.set_xticks(x); ax.set_xticklabels(actions, fontsize=11)
ax.set_ylabel("Q-Value", fontsize=11)
ax.set_title("Q-Values for State $s_{goal-1}$ During Training", fontsize=12,
             fontweight="bold", color=COLORS["blue"])
ax.legend(fontsize=10); ax.grid(True, axis="y")
plt.tight_layout()
plt.savefig(OUT / "q-table.png", dpi=DPI, bbox_inches="tight")
plt.close()
print("OK q-table.png")

print(f"\nAll plots saved to {OUT}")

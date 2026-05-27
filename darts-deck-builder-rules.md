# Triple-twenty: Prototype Rules

A 2-player card game inspired by 501 darts. Players aim at dartboard segments, then use cards to determine where each dart actually lands.

## Objective

Be the first player to reduce your score to exactly `0`.

To win, your final scoring dart must hit a **double** or the **bullseye**.

For early playtests, start at `301`. For a longer game, start at `501`.

## Components

Each player needs:

- A personal draw deck
- A discard pile
- A hand of cards
- A score tracker
- A reference for dartboard number order

Each player starts with the same deck.

## Starter Deck

Suggested first test deck:

```text
4x Clean Hit
5x Fat Segment
2x Drift Left
2x Drift Right
2x Wire
3x Focus
2x Safe Setup
1x Checkout Nerve
```

## Setup

1. Each player shuffles their deck.
2. Each player draws 5 cards.
3. Set each score to `301` or `501`.
4. Choose a starting player.

## Turn Overview

A player's turn is called a **visit**.

During a visit, the player may throw up to **three darts**.

For each dart:

1. Declare a target.
2. Play one Outcome card.
3. Optionally play Technique cards.
4. Resolve the score.
5. Check for bust or win.

After the visit, discard played cards. You may discard unplayed Technique cards, then draw back up to 5 cards.

## Declaring A Target

Before playing a card, choose exactly what you are aiming at.

Examples:

```text
T20 = Treble 20
D16 = Double 16
S19 = Single 19
Bull = 50
Outer Bull = 25
```

The target is your intent. The cards decide what actually happens.

## Outcome Cards

Each dart must use exactly one Outcome card.

```text
Clean Hit
Hit the exact segment you aimed at.
```

```text
Fat Segment
If aiming at a treble or double, score the single of that number.
If aiming at a single, hit it.
```

```text
Drift Left
Use the selected Drift variant. By default, Drift Left moves one number counter-clockwise.
```

```text
Drift Right
Use the selected Drift variant. By default, Drift Right moves one number clockwise.
```

```text
Wire
Score 0.
```

Before playing, choose one Drift variant for the whole game.

## Dartboard Order

Use standard dartboard order:

```text
20, 1, 18, 4, 13, 6, 10, 15, 2, 17,
3, 19, 7, 16, 8, 11, 14, 9, 12, 5
```

`Drift Right` moves clockwise.

`Drift Left` moves counter-clockwise.

Example:

- Aim at `T20`
- Drift Right scores `S1`
- Drift Left scores `S5`

## Drift Variants

Drift cards were too easy to abuse when they always moved exactly one number. Choose one of these variants before play.

### Variant 1: Unstable Drift

Drift Left and Drift Right remain Outcome cards.

When a Drift card is played:

1. Flip a coin or roll a die.
2. On heads, or `4-6` on a die, resolve the drift.
3. On tails, or `1-3` on a die, score the single of the original target number instead.

Drift still cannot hit a double or treble. It always scores a single number.

### Variant 2: Counterplay Drift

Drift Left and Drift Right become counterplay cards instead of normal Outcome cards.

When an opponent declares a target and plays an Outcome card, you may play Drift Left or Drift Right to move the result to the adjacent single number. The throwing player may cancel that Drift by playing Focus or Safe Setup.

In this variant:

- Drift cards are played from hand on another player's throw.
- Drift changes the result to an adjacent single number.
- Drift cannot cause a double, treble, or bull hit.
- Focus or Safe Setup cancels one Drift card played against your dart.

## Technique Cards

Technique cards modify outcomes. They are optional.

```text
Focus
Improve one outcome:
Wire -> Fat Segment
Fat Segment -> Double
In the Counterplay Drift variant, cancel one Drift card played against your dart.
```

```text
Safe Setup
If aiming at a single, ignore Drift and score the intended single.
In the Counterplay Drift variant, cancel one Drift card played against your dart.
```

```text
Checkout Nerve
If this dart could legally win the leg, cancel Wire or Drift and treat it as Clean Hit.
```

Unless a card says otherwise, Technique cards are discarded after use.

## Scoring

After resolving a dart, subtract its score from your current total.

Examples:

- `S20` scores 20
- `D20` scores 40
- `T20` scores 60
- `Bull` scores 50
- `Outer Bull` scores 25

## Busting

You bust if a dart causes any of the following:

- Your score goes below `0`
- Your score becomes exactly `1`
- Your score becomes `0` without hitting a double or bull

If you bust:

1. Your turn ends immediately.
2. Your score returns to what it was at the start of the visit.
3. All cards played during the visit are discarded.

## Winning

You win immediately if your score reaches exactly `0` and the final dart was a double or bull.

Examples:

- Score is `40`, hit `D20`: win.
- Score is `50`, hit `Bull`: win.
- Score is `20`, hit `S20`: bust, because the final dart was not a double or bull.

## End Of Visit

After throwing up to three darts, or after busting:

1. Discard all played cards.
2. You may discard any number of unplayed Technique cards.
3. Draw back up to 5 cards.
4. If your draw deck is empty, shuffle your discard pile to form a new deck.
5. The next player takes their visit.

Unplayed Outcome cards stay in your hand. This prevents players from freely discarding weak outcomes such as Wire.

## Example Turn

Player score: `96`

Hand:

```text
Clean Hit
Fat Segment
Focus
Drift Right
Safe Setup
```

Dart 1:

```text
Aim: T20
Play: Fat Segment + Focus
Result: Focus improves Fat Segment to D20.
Score: D20 = 40
New total: 56
```

Dart 2:

```text
Aim: D18
Play: Clean Hit
Score: D18 = 36
New total: 0
```

Because the final dart was a double, the player wins.

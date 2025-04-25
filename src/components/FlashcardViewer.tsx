import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils"; // Import cn for button styling
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Text,
} from "recharts"; // Using recharts directly as shadcn/chart exports them
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart";

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const deckModes: DeckMode[] = ["mixed", "upper", "lower"];
type DeckMode = "mixed" | "upper" | "lower";
type LetterState = { sound: boolean; name: boolean; write: boolean };
type DeckStates = Record<DeckMode, Record<string, LetterState>>;

const LOCAL_STORAGE_KEY = "flashcardAppStates_v2"; // New key for new structure

// Function to initialize state with nested structure
const getDefaultNestedState = (): DeckStates => {
  const defaultState: Partial<DeckStates> = {};
  deckModes.forEach((mode) => {
    defaultState[mode] = letters.reduce((acc, letter) => {
      acc[letter] = { sound: false, name: false, write: false };
      return acc;
    }, {} as Record<string, LetterState>);
  });
  return defaultState as DeckStates;
};

const getInitialState = (): DeckStates => {
  const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (savedState) {
    try {
      const parsedState = JSON.parse(savedState);
      // Validate new nested structure
      if (
        typeof parsedState === "object" &&
        parsedState !== null &&
        parsedState["mixed"] &&
        parsedState["mixed"]["A"] &&
        typeof parsedState["mixed"]["A"].sound === "boolean" // Check deeper structure
      ) {
        // Ensure all letters/modes are present in loaded state
        const completeState = getDefaultNestedState(); // Start with default structure
        deckModes.forEach((mode) => {
          if (parsedState[mode]) {
            letters.forEach((letter) => {
              if (parsedState[mode][letter]) {
                completeState[mode][letter] = parsedState[mode][letter];
              } // else keep default for missing letter
            });
          } // else keep default for missing mode
        });
        return completeState;
      }
    } catch (e) {
      console.error("Error parsing saved state v2 from localStorage", e);
    }
  }
  return getDefaultNestedState(); // Return default nested state
};

// Helper to map skill to icon
const skillIcons = {
  Sound: "⭐",
  Name: "💎",
  Write: "🚀",
};

// Custom YAxis Tick Component
const CustomYAxisTick = (props: any) => {
  const { x, y, payload } = props;
  const skill = payload.value as keyof typeof skillIcons;
  const icon = skillIcons[skill] || "";

  return (
    <g transform={`translate(${x},${y})`}>
      <Text x={0} y={0} dy={-8} textAnchor="end" fill="#666" fontSize={16}>
        {icon}
      </Text>
      <Text x={0} y={0} dy={10} textAnchor="end" fill="#666" fontSize={12}>
        {skill}
      </Text>
    </g>
  );
};

// Create Audio Context singleton
let audioContext: AudioContext | null = null;

// Function to create a magical twinkling sound
const playTwinkleSound = () => {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  // Create oscillators for a shimmering effect
  const numOscillators = 3;
  const baseFrequency = 1000; // Base frequency in Hz

  for (let i = 0; i < numOscillators; i++) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    // Randomize frequency slightly for each oscillator
    oscillator.frequency.value = baseFrequency + Math.random() * 500;
    oscillator.type = "sine";

    // Set up gain envelope
    gainNode.gain.value = 0;

    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Schedule the envelope
    const now = audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.1, now + 0.05); // Quick attack
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3); // Decay
    gainNode.gain.linearRampToValueAtTime(0, now + 0.4); // Release

    // Start and stop the oscillator
    oscillator.start(now);
    oscillator.stop(now + 0.4);
  }
};

export function FlashcardViewer() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardStates, setCardStates] = useState<DeckStates>(getInitialState);
  const [deckMode, setDeckMode] = useState<DeckMode>("mixed");

  const currentLetter = letters[currentIndex];
  // Get state for the current letter *and* deck mode
  const currentCardState = cardStates[deckMode]?.[currentLetter] || {
    sound: false,
    name: false,
    write: false,
  };

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cardStates));
  }, [cardStates]);

  // Calculate CUMULATIVE progress data across all decks
  const { progressData, totalPossible } = useMemo(() => {
    let soundChecks = 0;
    let nameChecks = 0;
    let writeChecks = 0;
    const totalPossibleChecks = letters.length * deckModes.length; // 26 * 3 = 78

    deckModes.forEach((mode) => {
      letters.forEach((letter) => {
        if (cardStates[mode]?.[letter]?.sound) soundChecks++;
        if (cardStates[mode]?.[letter]?.name) nameChecks++;
        if (cardStates[mode]?.[letter]?.write) writeChecks++;
      });
    });

    return {
      progressData: [
        // Data structure suitable for vertical chart comparing skills
        { skill: "Sound", checks: soundChecks },
        { skill: "Name", checks: nameChecks },
        { skill: "Write", checks: writeChecks },
      ],
      totalPossible: totalPossibleChecks,
    };
  }, [cardStates]);

  // Chart configuration - Use CSS variables directly
  const chartConfig = {
    Sound: { label: "Sound", color: "var(--chart-1)" },
    Name: { label: "Name", color: "var(--chart-2)" },
    Write: { label: "Write", color: "var(--chart-3)" },
  } satisfies ChartConfig;

  const goToPrevious = () => {
    if (currentIndex === 0) {
      // At the beginning, wrap to the previous deck's end
      const currentDeckIndex = deckModes.indexOf(deckMode);
      const prevDeckIndex =
        (currentDeckIndex - 1 + deckModes.length) % deckModes.length;
      setDeckMode(deckModes[prevDeckIndex]);
      setCurrentIndex(letters.length - 1); // Go to Z
    } else {
      // Just go to the previous letter
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex === letters.length - 1) {
      // At the end, wrap to the next deck's beginning
      const currentDeckIndex = deckModes.indexOf(deckMode);
      const nextDeckIndex = (currentDeckIndex + 1) % deckModes.length;
      setDeckMode(deckModes[nextDeckIndex]);
      setCurrentIndex(0); // Go to A
    } else {
      // Just go to the next letter
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Update state based on current letter AND deck mode
  const handleCheckChange = (key: keyof LetterState, checked: boolean) => {
    setCardStates((prevStates) => ({
      ...prevStates,
      [deckMode]: {
        ...prevStates[deckMode],
        [currentLetter]: {
          ...prevStates[deckMode]?.[currentLetter],
          [key]: checked,
        },
      },
    }));

    // Play twinkle sound only when checking a box
    if (checked === true) {
      playTwinkleSound();
    }
  };

  return (
    // Main container div for title and card
    <div className="flex flex-col items-center mt-4 space-y-4">
      {/* Adjust title size and letter spacing */}
      <h2 className="text-2xl font-orbitron font-bold text-center tracking-wide">
        early literacy trainer
      </h2>

      {/* Outer Card Wrapper */}
      <Card className="w-full max-w-xs mx-auto p-4 border border-border shadow-sm">
        {/* Inner container */}
        <div className="flex flex-col items-center p-4 space-y-4">
          {/* Deck Selection Buttons */}
          <div className="flex space-x-2">
            <Button
              variant={deckMode === "mixed" ? "default" : "outline"}
              onClick={() => setDeckMode("mixed")}
            >
              Aa
            </Button>
            <Button
              variant={deckMode === "upper" ? "default" : "outline"}
              onClick={() => setDeckMode("upper")}
            >
              A
            </Button>
            <Button
              variant={deckMode === "lower" ? "default" : "outline"}
              onClick={() => setDeckMode("lower")}
            >
              a
            </Button>
          </div>

          {/* Flashcard - Add bg-muted back */}
          <Card className="w-[20rem] h-[20rem] shadow-lg border-2 border-black bg-muted box-border flex flex-col">
            <CardContent className="flex flex-col justify-center items-center p-3 flex-grow">
              {/* Restore letter size */}
              <span className="text-7xl font-vic font-bold select-none mb-1">
                {deckMode === "mixed" && (
                  <>
                    {currentLetter}
                    <span className="font-bold">
                      {currentLetter.toLowerCase()}
                    </span>
                  </>
                )}
                {deckMode === "upper" && currentLetter}
                {deckMode === "lower" && currentLetter.toLowerCase()}
              </span>

              {/* Checkboxes - space-y-1, mt-0 */}
              <div className="flex flex-col items-start space-y-1 mt-0">
                {/* Sound Checkbox */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sound"
                    checked={currentCardState.sound}
                    onCheckedChange={(checked) =>
                      handleCheckChange("sound", checked === true)
                    }
                  />
                  <label
                    htmlFor="sound"
                    className="text-base font-sans cursor-pointer flex items-center"
                  >
                    Sound?
                    <span className="inline-block w-5 text-left ml-1">
                      {currentCardState.sound ? "⭐" : ""}
                    </span>
                  </label>
                </div>
                {/* Name Checkbox */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="name"
                    checked={currentCardState.name}
                    onCheckedChange={(checked) =>
                      handleCheckChange("name", checked === true)
                    }
                  />
                  <label
                    htmlFor="name"
                    className="text-base font-sans cursor-pointer flex items-center"
                  >
                    Name?
                    <span className="inline-block w-5 text-left ml-1">
                      {currentCardState.name ? "💎" : ""}
                    </span>
                  </label>
                </div>
                {/* Write Checkbox */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="write"
                    checked={currentCardState.write}
                    onCheckedChange={(checked) =>
                      handleCheckChange("write", checked === true)
                    }
                  />
                  <label
                    htmlFor="write"
                    className="text-base font-sans cursor-pointer flex items-center"
                  >
                    Write?
                    <span className="inline-block w-5 text-left ml-1">
                      {currentCardState.write ? "🚀" : ""}
                    </span>
                  </label>
                </div>
              </div>
            </CardContent>
            {/* Footer - remove bottom padding */}
            <CardFooter className="flex justify-between pt-0 pb-2">
              <Button
                variant="outline"
                size="icon"
                onClick={goToPrevious}
                aria-label="Previous Letter"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={goToNext}
                aria-label="Next Letter"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>

          {/* Progress Chart - No width constraints needed here */}
          <div className="w-full">
            <ChartContainer config={chartConfig} className="w-full">
              <BarChart
                accessibilityLayer
                data={progressData}
                layout="vertical"
                margin={{ left: 0, right: 0, top: 10, bottom: 10 }}
              >
                <CartesianGrid horizontal={false} />
                <YAxis
                  dataKey="skill"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  width={60}
                  tick={<CustomYAxisTick />}
                />
                <XAxis
                  dataKey="checks"
                  type="number"
                  hide
                  domain={[0, totalPossible]}
                />
                <Tooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      indicator="line"
                      formatter={(value, name) =>
                        `${value} / ${totalPossible} checks`
                      }
                    />
                  }
                />
                <Bar dataKey="checks" layout="vertical" radius={4}>
                  {progressData.map((entry) => (
                    <Cell
                      key={`cell-${entry.skill}`}
                      fill={
                        chartConfig[entry.skill as keyof typeof chartConfig]
                          .color
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        </div>
      </Card>
    </div>
  );
}

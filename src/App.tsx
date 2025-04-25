// In src/App.tsx
// import { Button } from "@/components/ui/button";
import { FlashcardViewer } from "@/components/FlashcardViewer"; // Import the new component

export default function App() {
  return (
    <div className="container mx-auto py-10">
      {/* Optional: Add a title if you like */}
      {/* <h1 className="text-2xl font-bold text-center mb-6">Alphabet Flashcards</h1> */}
      <FlashcardViewer />
    </div>
  );
}

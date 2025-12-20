/**
 * Feedback Panel Component
 * 
 * Provides user feedback collection for AI responses:
 * - Quick thumbs up/down rating
 * - Expandable form for detailed feedback
 * - Categories: accuracy, helpfulness, clarity, completeness
 * - Free-form text input
 * 
 * This is the backbone for the evolution system:
 * User feedback → Stored → Analyzed → Generates improvements → PR for review
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp, ThumbsDown, ChevronDown, Send, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface FeedbackData {
  messageId: string;
  chatId?: string;
  rating: "positive" | "negative" | null;
  categories: {
    accuracy: number;      // 1-5 scale
    helpfulness: number;   
    clarity: number;       
    completeness: number;  
  };
  likedAspects: string[];
  dislikedAspects: string[];
  freeformText: string;
  promptSnapshot?: string;
  responseSnapshot?: string;
}

interface FeedbackPanelProps {
  messageId: string;
  chatId?: string;
  promptSnapshot?: string;
  responseSnapshot?: string;
  onSubmit?: (feedback: FeedbackData) => void;
  className?: string;
}

// ============================================================================
// QUICK ASPECTS FOR SELECTION
// ============================================================================

const positiveAspects = [
  "Accurate information",
  "Clear explanation",
  "Good examples",
  "Thorough answer",
  "Easy to understand",
  "Actionable advice",
  "Good formatting",
  "Quick response",
];

const negativeAspects = [
  "Inaccurate information",
  "Confusing explanation",
  "Missing examples",
  "Incomplete answer",
  "Too verbose",
  "Not actionable",
  "Poor formatting",
  "Didn't understand question",
];

// ============================================================================
// RATING BUTTON
// ============================================================================

interface RatingButtonProps {
  type: "positive" | "negative";
  selected: boolean;
  onClick: () => void;
}

function RatingButton({ type, selected, onClick }: RatingButtonProps) {
  const Icon = type === "positive" ? ThumbsUp : ThumbsDown;
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={cn(
        "h-8 w-8 transition-all",
        selected && type === "positive" && "text-green-500 bg-green-500/10 hover:bg-green-500/20",
        selected && type === "negative" && "text-red-500 bg-red-500/10 hover:bg-red-500/20",
        !selected && "text-muted-foreground hover:text-foreground"
      )}
      data-testid={`feedback-${type}`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

// ============================================================================
// ASPECT CHIP
// ============================================================================

interface AspectChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  variant: "positive" | "negative";
}

function AspectChip({ label, selected, onClick, variant }: AspectChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
        selected && variant === "positive" && "bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/30",
        selected && variant === "negative" && "bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/30",
        !selected && "bg-muted text-muted-foreground hover:bg-muted/80 border border-transparent"
      )}
      data-testid={`aspect-chip-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {label}
    </button>
  );
}

// ============================================================================
// CATEGORY SLIDER
// ============================================================================

interface CategorySliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function CategorySlider({ label, value, onChange }: CategorySliderProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm w-28 text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={cn(
              "w-8 h-8 rounded-md text-xs font-medium transition-all",
              value >= n 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
            data-testid={`slider-${label.toLowerCase()}-${n}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN FEEDBACK PANEL
// ============================================================================

export function FeedbackPanel({ messageId, chatId, promptSnapshot, responseSnapshot, onSubmit, className }: FeedbackPanelProps) {
  const [rating, setRating] = useState<"positive" | "negative" | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [categories, setCategories] = useState({
    accuracy: 0,
    helpfulness: 0,
    clarity: 0,
    completeness: 0,
  });
  const [likedAspects, setLikedAspects] = useState<string[]>([]);
  const [dislikedAspects, setDislikedAspects] = useState<string[]>([]);
  const [freeformText, setFreeformText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRating = (type: "positive" | "negative") => {
    const newRating = rating === type ? null : type;
    setRating(newRating);
    
    // Auto-expand on first rating
    if (newRating && !isExpanded) {
      setIsExpanded(true);
    }
  };

  const toggleAspect = (aspect: string, type: "liked" | "disliked") => {
    if (type === "liked") {
      setLikedAspects(prev => 
        prev.includes(aspect) 
          ? prev.filter(a => a !== aspect)
          : [...prev, aspect]
      );
    } else {
      setDislikedAspects(prev => 
        prev.includes(aspect) 
          ? prev.filter(a => a !== aspect)
          : [...prev, aspect]
      );
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    
    const feedback: FeedbackData = {
      messageId,
      chatId,
      rating,
      categories,
      likedAspects,
      dislikedAspects,
      freeformText,
      promptSnapshot,
      responseSnapshot,
    };
    
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedback),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit feedback");
      }
      
      onSubmit?.(feedback);
      setSubmitted(true);
      setIsExpanded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setRating(null);
    setCategories({ accuracy: 0, helpfulness: 0, clarity: 0, completeness: 0 });
    setLikedAspects([]);
    setDislikedAspects([]);
    setFreeformText("");
    setSubmitted(false);
    setIsExpanded(false);
    setError(null);
  };

  if (submitted) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <span>Thanks for your feedback!</span>
        <button 
          onClick={handleReset}
          className="text-xs underline hover:text-foreground"
          data-testid="feedback-reset"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className={cn("", className)} data-testid="feedback-panel">
      {/* Quick Rating Row */}
      <div className="flex items-center gap-2">
        <RatingButton 
          type="positive" 
          selected={rating === "positive"} 
          onClick={() => handleRating("positive")} 
        />
        <RatingButton 
          type="negative" 
          selected={rating === "negative"} 
          onClick={() => handleRating("negative")} 
        />
        
        {rating && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-2"
            data-testid="feedback-expand-toggle"
          >
            <span>Add details</span>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-3 w-3" />
            </motion.div>
          </button>
        )}
      </div>

      {/* Expanded Feedback Form */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3 pb-1 space-y-4 border-t border-border/50">
              {/* What did you like? */}
              {(rating === "positive" || rating === null) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">What did you like?</label>
                  <div className="flex flex-wrap gap-2">
                    {positiveAspects.map((aspect) => (
                      <AspectChip
                        key={aspect}
                        label={aspect}
                        selected={likedAspects.includes(aspect)}
                        onClick={() => toggleAspect(aspect, "liked")}
                        variant="positive"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* What could be improved? */}
              {(rating === "negative" || rating === null) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">What could be improved?</label>
                  <div className="flex flex-wrap gap-2">
                    {negativeAspects.map((aspect) => (
                      <AspectChip
                        key={aspect}
                        label={aspect}
                        selected={dislikedAspects.includes(aspect)}
                        onClick={() => toggleAspect(aspect, "disliked")}
                        variant="negative"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Category Ratings */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Rate specific aspects:</label>
                <div className="space-y-2">
                  <CategorySlider
                    label="Accuracy"
                    value={categories.accuracy}
                    onChange={(v) => setCategories(prev => ({ ...prev, accuracy: v }))}
                  />
                  <CategorySlider
                    label="Helpfulness"
                    value={categories.helpfulness}
                    onChange={(v) => setCategories(prev => ({ ...prev, helpfulness: v }))}
                  />
                  <CategorySlider
                    label="Clarity"
                    value={categories.clarity}
                    onChange={(v) => setCategories(prev => ({ ...prev, clarity: v }))}
                  />
                  <CategorySlider
                    label="Completeness"
                    value={categories.completeness}
                    onChange={(v) => setCategories(prev => ({ ...prev, completeness: v }))}
                  />
                </div>
              </div>

              {/* Freeform Text */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Anything else? (optional)</label>
                <Textarea
                  value={freeformText}
                  onChange={(e) => setFreeformText(e.target.value)}
                  placeholder="Share your thoughts..."
                  className="min-h-[80px] resize-none"
                  data-testid="feedback-freeform"
                />
              </div>

              {/* Error message */}
              {error && (
                <div className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded">
                  {error}
                </div>
              )}

              {/* Submit / Cancel */}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(false)}
                  disabled={isSubmitting}
                  data-testid="feedback-cancel"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  data-testid="feedback-submit"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1" />
                      Submit Feedback
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FeedbackPanel;

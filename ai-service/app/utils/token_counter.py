import tiktoken
from typing import List
import logging

logger = logging.getLogger(__name__)

class TokenCounter:
    """Utility for counting LLM tokens"""
    
    def __init__(self, model: str = "gpt-4o-mini"):
        self.model = model
        try:
            self.encoder = tiktoken.encoding_for_model(model)
        except KeyError:
            # Fallback to cl100k_base for unknown models (Ollama, etc.)
            # This is fine - we'll use approximate counting
            self.encoder = tiktoken.get_encoding("cl100k_base")
    
    def count_tokens(self, text: str) -> int:
        """
        Count tokens in text
        
        Args:
            text: Text to count tokens for
            
        Returns:
            Number of tokens
        """
        try:
            tokens = self.encoder.encode(text)
            return len(tokens)
        except Exception as e:
            logger.error(f"Error counting tokens: {e}")
            # Rough estimate: 1 token ≈ 4 characters
            return len(text) // 4
    
    def count_tokens_batch(self, texts: List[str]) -> int:
        """
        Count tokens across multiple texts
        
        Args:
            texts: List of texts
            
        Returns:
            Total token count
        """
        return sum(self.count_tokens(text) for text in texts)
    
    def truncate_to_token_limit(self, text: str, max_tokens: int) -> str:
        """
        Truncate text to fit within token limit
        
        Args:
            text: Text to truncate
            max_tokens: Maximum tokens allowed
            
        Returns:
            Truncated text
        """
        try:
            tokens = self.encoder.encode(text)
            if len(tokens) <= max_tokens:
                return text
            
            # Truncate and decode
            truncated_tokens = tokens[:max_tokens]
            truncated_text = self.encoder.decode(truncated_tokens)
            
            logger.warning(f"Text truncated from {len(tokens)} to {max_tokens} tokens")
            return truncated_text
        except Exception as e:
            logger.error(f"Error truncating text: {e}")
            # Rough truncation
            chars_to_keep = max_tokens * 4
            return text[:chars_to_keep]
    
    def estimate_cost(self, input_tokens: int, output_tokens: int, model: str = None) -> float:
        """
        Estimate cost based on token usage
        
        Args:
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            model: Model name (optional, uses instance model if not provided)
            
        Returns:
            Estimated cost in USD
        """
        model = model or self.model
        
        # Pricing per 1M tokens (as of Dec 2024)
        pricing = {
            "gpt-4o-mini": {"input": 0.150, "output": 0.600},
            "gpt-4o": {"input": 2.50, "output": 10.00},
            "gpt-4": {"input": 30.00, "output": 60.00},
            "claude-haiku-4-20250514": {"input": 0.25, "output": 1.25},
            "claude-sonnet-4-20250514": {"input": 3.00, "output": 15.00}
        }
        
        # Get pricing or use default
        model_pricing = pricing.get(model, {"input": 0.150, "output": 0.600})
        
        input_cost = (input_tokens / 1_000_000) * model_pricing["input"]
        output_cost = (output_tokens / 1_000_000) * model_pricing["output"]
        
        return round(input_cost + output_cost, 6)

# Global instance
token_counter = TokenCounter()
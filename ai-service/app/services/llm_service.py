from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
import ollama
from app.config import settings
from typing import Dict, Any
import json
import logging
import asyncio

logger = logging.getLogger(__name__)

class LLMService:
    """Service for interacting with LLM providers (OpenAI, Anthropic, Ollama)"""
    
    def __init__(self):
        self.provider = settings.LLM_PROVIDER
        
        # ============================================================
        # INITIALIZE LLM CLIENT BASED ON PROVIDER
        # ============================================================
        
        if self.provider == "openai":
            # Cloud API - Requires API key
            self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            self.model = settings.OPENAI_MODEL
            logger.info(f"✅ Using OPENAI Cloud API: {self.model}")
            
        elif self.provider == "anthropic":
            # Cloud API - Requires API key
            self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
            self.model = settings.ANTHROPIC_MODEL
            logger.info(f"✅ Using ANTHROPIC Cloud API: {self.model}")
            
        elif self.provider == "ollama":
            # Local LLM - FREE, no API key required
            self.client = ollama.AsyncClient(host=settings.OLLAMA_BASE_URL)
            self.model = settings.OLLAMA_MODEL
            logger.info(f"✅ Using LOCAL Ollama LLM: {self.model}")
            logger.info(f"   Base URL: {settings.OLLAMA_BASE_URL}")
            logger.info(f"   💡 To switch to OpenAI, change LLM_PROVIDER=openai in .env")
            
        else:
            raise ValueError(f"Unsupported LLM provider: {self.provider}")
    
    async def analyze_code(self, prompt: str) -> Dict[str, Any]:
        """
        Send code analysis prompt to LLM
        
        Args:
            prompt: Full prompt with code and instructions
            
        Returns:
            Parsed JSON response from LLM
        """
        try:
            if self.provider == "openai":
                return await self._call_openai(prompt)
            elif self.provider == "anthropic":
                return await self._call_anthropic(prompt)
            elif self.provider == "ollama":
                return await self._call_ollama(prompt)
        except Exception as e:
            logger.error(f"❌ LLM analysis error: {e}")
            raise
    
    async def _call_openai(self, prompt: str) -> Dict[str, Any]:
        """Call OpenAI Cloud API"""
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a code analysis expert. Always respond with valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.1,
                seed = 42,
                max_tokens=4000
            )
            
            content = response.choices[0].message.content
            usage = response.usage
            
            # Parse JSON response
            result = self._extract_json(content)
            
            # Add metadata
            result["_metadata"] = {
                "provider": "openai",
                "model": self.model,
                "tokens_input": usage.prompt_tokens,
                "tokens_output": usage.completion_tokens,
                "tokens_total": usage.total_tokens
            }
            
            logger.info(f"✅ OpenAI analysis complete. Tokens: {usage.total_tokens}")
            return result
            
        except Exception as e:
            logger.error(f"❌ OpenAI API error: {e}")
            raise
    
    async def _call_anthropic(self, prompt: str) -> Dict[str, Any]:
        """Call Anthropic Claude Cloud API"""
        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=4000,
                temperature=0.3,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            content = response.content[0].text
            usage = response.usage
            
            # Parse JSON response
            result = self._extract_json(content)
            
            # Add metadata
            result["_metadata"] = {
                "provider": "anthropic",
                "model": self.model,
                "tokens_input": usage.input_tokens,
                "tokens_output": usage.output_tokens,
                "tokens_total": usage.input_tokens + usage.output_tokens
            }
            
            logger.info(f"✅ Anthropic analysis complete. Tokens: {usage.input_tokens + usage.output_tokens}")
            return result
            
        except Exception as e:
            logger.error(f"❌ Anthropic API error: {e}")
            raise
    
    async def _call_ollama(self, prompt: str) -> Dict[str, Any]:
        """
        Call Ollama Local LLM
        
        FREE - No API key required
        Runs locally on your machine
        """
        try:
            logger.info(f"🤖 Calling local Ollama model: {self.model}")
            
            # Call Ollama using async client
            response = await self.client.chat(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a code analysis expert. Always respond with valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                options={
                    "temperature": 0.3,
                    "num_predict": 4000  # Max tokens to generate
                }
            )
            
            content = response['message']['content']
            
            # Parse JSON response
            result = self._extract_json(content)
            
            # Estimate token usage (Ollama doesn't provide exact counts)
            # Rough estimate: 1 token ≈ 4 characters
            estimated_input_tokens = len(prompt) // 4
            estimated_output_tokens = len(content) // 4
            estimated_total = estimated_input_tokens + estimated_output_tokens
            
            # Add metadata
            result["_metadata"] = {
                "provider": "ollama",
                "model": self.model,
                "tokens_input": estimated_input_tokens,
                "tokens_output": estimated_output_tokens,
                "tokens_total": estimated_total
            }
            
            logger.info(f"✅ Ollama analysis complete. Est. tokens: {estimated_total}")
            return result
            
        except Exception as e:
            logger.error(f"❌ Ollama error: {e}")
            logger.error(f"   Make sure Ollama is running: ollama serve")
            logger.error(f"   And model is pulled: ollama pull {self.model}")
            raise
    
    def _extract_json(self, content: str) -> Dict[str, Any]:
        """
        Extract JSON from LLM response (handles markdown code blocks and malformed JSON)
        """
        import re
        
        original_content = content
        
        # Step 1: Try direct JSON parse
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass
        
        # Step 2: Extract from markdown code blocks
        if "```json" in content:
            match = re.search(r'```json\s*\n(.*?)\n```', content, re.DOTALL)
            if match:
                content = match.group(1).strip()
        elif "```" in content:
            match = re.search(r'```\s*\n(.*?)\n```', content, re.DOTALL)
            if match:
                content = match.group(1).strip()
        
        # Step 3: Try parsing extracted content
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass
        
        # Step 4: Find JSON object boundaries
        # Look for outermost { ... }
        start_idx = content.find('{')
        if start_idx == -1:
            raise ValueError("No JSON object found in response")
        
        # Find matching closing brace
        brace_count = 0
        end_idx = -1
        for i in range(start_idx, len(content)):
            if content[i] == '{':
                brace_count += 1
            elif content[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    end_idx = i + 1
                    break
        
        if end_idx == -1:
            raise ValueError("Malformed JSON: no matching closing brace")
        
        content = content[start_idx:end_idx]
        
        # Step 5: Try parsing bounded JSON
        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            # Step 6: Last resort - try to fix common issues
            logger.warning(f"Attempting to fix malformed JSON: {e}")
            
            # Fix trailing commas
            content = re.sub(r',(\s*[}\]])', r'\1', content)
            
            # Fix single quotes to double quotes (if not inside strings)
            # This is risky but sometimes helps
            
            # Try one more time
            try:
                return json.loads(content)
            except json.JSONDecodeError as e2:
                logger.error(f"❌ Failed to parse JSON from LLM response")
                logger.error(f"   Original response length: {len(original_content)} chars")
                logger.error(f"   Response preview: {original_content[:500]}...")
                logger.error(f"   JSON error: {e2}")
                
                # Return a fallback structure instead of crashing
                return {
                    "issues": [],
                    "summary": {
                        "total_issues": 0,
                        "critical": 0,
                        "warnings": 0,
                        "info": 0
                    },
                    "recommendations": [
                        "LLM response parsing failed. Please try again or use a different model."
                    ],
                    "_error": f"JSON parsing failed: {str(e2)}"
                }

# Global instance
llm_service = LLMService()
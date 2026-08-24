import asyncio
from typing import List
from app.agent.nodes import detect_node, diagnose_node, decide_node, execute_node
from app.agent.state import SequencerState
from app.models import MandateFailure


class SequencerAgent:
    """Deterministic Finite State Machine (FSM) Agent for Mandate Retry Sequencing."""

    async def run(self, failure: MandateFailure) -> SequencerState:
        """Run the full Sequencer FSM pipeline on a single mandate failure."""
        state = SequencerState(failure=failure)

        # 1. Detection
        state = await detect_node(state)

        # 2. Diagnosis (Taxonomy + LLM fallback)
        state = await diagnose_node(state)

        # 3. Decision (Deterministic Safety Policy)
        state = await decide_node(state)

        # 4. Execution & Dispatch
        state = await execute_node(state)

        return state

    def run_sync(self, failure: MandateFailure) -> SequencerState:
        """Synchronous wrapper for script & dashboard execution."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            # In an existing event loop (e.g. within an async framework)
            import nest_asyncio
            nest_asyncio.apply()
            return asyncio.run(self.run(failure))
        else:
            return asyncio.run(self.run(failure))

    async def run_batch(self, failures: List[MandateFailure]) -> List[SequencerState]:
        """Run batch of failures concurrently."""
        tasks = [self.run(f) for f in failures]
        return await asyncio.gather(*tasks)


sequencer_agent = SequencerAgent()

import raw from '../../assets/models/cat-sprite.json'
import { parseModelConfig, type ModelConfig } from './modelConfig'

/**
 * The pet model in use. Main reads it for the window size, the renderer for drawing.
 * To swap models, drop a new .png + .json into assets/models/ and point this import at it.
 */
export const ACTIVE_MODEL: ModelConfig = parseModelConfig(raw)

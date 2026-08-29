package expo.modules.portionscanner

import android.opengl.GLES11Ext
import android.opengl.GLES20
import com.google.ar.core.Coordinates2d
import com.google.ar.core.Frame
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

internal class CameraBackgroundRenderer {
  private val quadVertices = floatBufferOf(
    -1f, -1f,
    1f, -1f,
    -1f, 1f,
    1f, 1f
  )

  private val transformedTexCoords = FloatArray(8)
  private val texCoords: FloatBuffer = floatBufferOf(
    0f, 0f,
    1f, 0f,
    0f, 1f,
    1f, 1f
  )

  private var program = 0
  private var positionAttribute = -1
  private var texCoordAttribute = -1
  private var textureUniform = -1
  private var textureCoordinatesReady = false

  var textureId: Int = -1
    private set

  fun createOnGlThread() {
    val textures = IntArray(1)
    GLES20.glGenTextures(1, textures, 0)
    textureId = textures[0]

    GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)
    GLES20.glTexParameteri(
      GLES11Ext.GL_TEXTURE_EXTERNAL_OES,
      GLES20.GL_TEXTURE_MIN_FILTER,
      GLES20.GL_LINEAR
    )
    GLES20.glTexParameteri(
      GLES11Ext.GL_TEXTURE_EXTERNAL_OES,
      GLES20.GL_TEXTURE_MAG_FILTER,
      GLES20.GL_LINEAR
    )
    GLES20.glTexParameteri(
      GLES11Ext.GL_TEXTURE_EXTERNAL_OES,
      GLES20.GL_TEXTURE_WRAP_S,
      GLES20.GL_CLAMP_TO_EDGE
    )
    GLES20.glTexParameteri(
      GLES11Ext.GL_TEXTURE_EXTERNAL_OES,
      GLES20.GL_TEXTURE_WRAP_T,
      GLES20.GL_CLAMP_TO_EDGE
    )

    val vertexShader = compileShader(GLES20.GL_VERTEX_SHADER, VERTEX_SHADER)
    val fragmentShader = compileShader(GLES20.GL_FRAGMENT_SHADER, FRAGMENT_SHADER)

    program = GLES20.glCreateProgram()
    GLES20.glAttachShader(program, vertexShader)
    GLES20.glAttachShader(program, fragmentShader)
    GLES20.glLinkProgram(program)

    val linkStatus = IntArray(1)
    GLES20.glGetProgramiv(program, GLES20.GL_LINK_STATUS, linkStatus, 0)
    if (linkStatus[0] == 0) {
      val log = GLES20.glGetProgramInfoLog(program)
      GLES20.glDeleteProgram(program)
      throw IllegalStateException("Could not link AR camera shader: $log")
    }

    positionAttribute = GLES20.glGetAttribLocation(program, "a_Position")
    texCoordAttribute = GLES20.glGetAttribLocation(program, "a_TexCoord")
    textureUniform = GLES20.glGetUniformLocation(program, "u_Texture")

    GLES20.glDeleteShader(vertexShader)
    GLES20.glDeleteShader(fragmentShader)
  }

  fun draw(frame: Frame) {
    if (frame.timestamp == 0L || textureId < 0 || program == 0) return

    if (frame.hasDisplayGeometryChanged() || !textureCoordinatesReady) {
      frame.transformCoordinates2d(
        Coordinates2d.OPENGL_NORMALIZED_DEVICE_COORDINATES,
        QUAD_COORDS,
        Coordinates2d.TEXTURE_NORMALIZED,
        transformedTexCoords
      )
      texCoords.position(0)
      texCoords.put(transformedTexCoords)
      texCoords.position(0)
      textureCoordinatesReady = true
    }

    GLES20.glDisable(GLES20.GL_DEPTH_TEST)
    GLES20.glDepthMask(false)
    GLES20.glUseProgram(program)

    quadVertices.position(0)
    GLES20.glVertexAttribPointer(
      positionAttribute,
      2,
      GLES20.GL_FLOAT,
      false,
      0,
      quadVertices
    )
    GLES20.glEnableVertexAttribArray(positionAttribute)

    texCoords.position(0)
    GLES20.glVertexAttribPointer(
      texCoordAttribute,
      2,
      GLES20.GL_FLOAT,
      false,
      0,
      texCoords
    )
    GLES20.glEnableVertexAttribArray(texCoordAttribute)

    GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
    GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)
    GLES20.glUniform1i(textureUniform, 0)

    GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)

    GLES20.glDisableVertexAttribArray(positionAttribute)
    GLES20.glDisableVertexAttribArray(texCoordAttribute)
    GLES20.glDepthMask(true)
  }

  fun resetGeometry() {
    textureCoordinatesReady = false
  }

  fun releaseOnGlThread() {
    if (textureId >= 0) {
      GLES20.glDeleteTextures(1, intArrayOf(textureId), 0)
      textureId = -1
    }
    if (program != 0) {
      GLES20.glDeleteProgram(program)
      program = 0
    }
  }

  private fun compileShader(type: Int, source: String): Int {
    val shader = GLES20.glCreateShader(type)
    GLES20.glShaderSource(shader, source)
    GLES20.glCompileShader(shader)

    val compiled = IntArray(1)
    GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, compiled, 0)
    if (compiled[0] == 0) {
      val log = GLES20.glGetShaderInfoLog(shader)
      GLES20.glDeleteShader(shader)
      throw IllegalStateException("Could not compile AR camera shader: $log")
    }
    return shader
  }

  companion object {
    private val QUAD_COORDS = floatArrayOf(
      -1f, -1f,
      1f, -1f,
      -1f, 1f,
      1f, 1f
    )

    private const val VERTEX_SHADER = """
      attribute vec4 a_Position;
      attribute vec2 a_TexCoord;
      varying vec2 v_TexCoord;
      void main() {
        gl_Position = a_Position;
        v_TexCoord = a_TexCoord;
      }
    """

    private const val FRAGMENT_SHADER = """
      #extension GL_OES_EGL_image_external : require
      precision mediump float;
      uniform samplerExternalOES u_Texture;
      varying vec2 v_TexCoord;
      void main() {
        gl_FragColor = texture2D(u_Texture, v_TexCoord);
      }
    """

    private fun floatBufferOf(vararg values: Float): FloatBuffer {
      return ByteBuffer
        .allocateDirect(values.size * 4)
        .order(ByteOrder.nativeOrder())
        .asFloatBuffer()
        .apply {
          put(values)
          position(0)
        }
    }
  }
}

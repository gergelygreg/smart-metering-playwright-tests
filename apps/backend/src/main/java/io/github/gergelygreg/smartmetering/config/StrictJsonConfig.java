package io.github.gergelygreg.smartmetering.config;

import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import tools.jackson.databind.cfg.CoercionAction;
import tools.jackson.databind.cfg.CoercionInputShape;

@Configuration
public class StrictJsonConfig {

    @Bean
    public JsonMapperBuilderCustomizer strictStringCoercion() {
        return builder -> builder.withCoercionConfig(
                String.class,
                coercion -> {
                    coercion.setCoercion(
                            CoercionInputShape.Integer,
                            CoercionAction.Fail
                    );
                    coercion.setCoercion(
                            CoercionInputShape.Float,
                            CoercionAction.Fail
                    );
                    coercion.setCoercion(
                            CoercionInputShape.Boolean,
                            CoercionAction.Fail
                    );
                }
        );
    }
}
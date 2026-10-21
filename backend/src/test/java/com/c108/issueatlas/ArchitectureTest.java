package com.c108.issueatlas;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.GeneralCodingRules.NO_CLASSES_SHOULD_ACCESS_STANDARD_STREAMS;
import static com.tngtech.archunit.library.GeneralCodingRules.NO_CLASSES_SHOULD_USE_FIELD_INJECTION;
import static com.tngtech.archunit.library.GeneralCodingRules.NO_CLASSES_SHOULD_USE_JAVA_UTIL_LOGGING;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.Test;

/**
 * 패키지 구조 규칙. 패키지 구조가 정해지면 계층 규칙(예: controller → service → repository)을 여기에 더한다.
 * 실패 메시지에 위반 클래스와 줄이 나온다. 고친 뒤 {@code pnpm backend:test}.
 */
class ArchitectureTest {

	private static final String ROOT = "com.c108.issueatlas";

	private static final JavaClasses CLASSES = new ClassFileImporter()
		.withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
		.importPackages(ROOT);

	@Test
	void 기능_패키지끼리_순환_의존이_없다() {
		slices().matching(ROOT + ".(*)..").should().beFreeOfCycles().allowEmptyShould(true).check(CLASSES);
	}

	@Test
	void 필드_주입_대신_생성자_주입을_쓴다() {
		// 필드가 하나도 없는 초기 상태에서도 통과하도록 빈 검사를 허용한다
		NO_CLASSES_SHOULD_USE_FIELD_INJECTION.allowEmptyShould(true).check(CLASSES);
	}

	@Test
	void System_out_대신_로거를_쓴다() {
		NO_CLASSES_SHOULD_ACCESS_STANDARD_STREAMS.check(CLASSES);
		NO_CLASSES_SHOULD_USE_JAVA_UTIL_LOGGING.check(CLASSES);
	}

	@Test
	void 웹_계층은_JPA_리포지토리를_직접_쓰지_않는다() {
		noClasses().that().areAnnotatedWith(org.springframework.web.bind.annotation.RestController.class)
			.should().dependOnClassesThat().areAssignableTo(org.springframework.data.repository.Repository.class)
			.allowEmptyShould(true)
			.check(CLASSES);
	}
}

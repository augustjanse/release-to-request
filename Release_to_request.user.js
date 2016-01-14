// ==UserScript==
// @name        Release to request
// @description	Import metadata from a MusicBrainz release group into a What.CD request
// @namespace   http://janse.se/
// @include     https://what.cd/requests.php?action=new
// @version     0.1
// @grant       none
// ==/UserScript==

var debugging = false;

$("tbody").prepend('<tr> <td class="label">Import from MusicBrainz</td> <td> <input id="mbid_box" size="8" value="" type="text"> <input value="Import" id="mbid_button" type="button"> </td> </tr>');
$("#mbid_button").click(importMetadata);

if(debugging) {
	$("#mbid_box").val("0e5b4580-4e6d-43e6-8384-0d13ac52a9d7");
	$("#mbid_button").click();
}

function importMetadata(){
	reset();

	var input = $("#mbid_box").val();
	var mbid = input.match("[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+")[0];
	entity = null;
	setEntity(input, mbid);
	console.log(entity + " found");

	url = 'http://musicbrainz.org/release-group/' + mbid;

	if (entity == "release-group") {
		// get metadata from release group
		$.ajax({
			method: 'GET',
			url: 'https://musicbrainz.org/ws/2/release-group/' + mbid + '?inc=artists',
			success: enterReleaseGroup,
			error: function(xml) {
				console.log("Release group request failed");
			}
		});

		// get links from connected releases
		$.ajax({
			method: 'GET',
			url: 'https://musicbrainz.org/ws/2/release?release-group=' + mbid + '&inc=url-rels',
			success: setDescription,
			error: function(xml) {
				console.log("Release request failed");
			}
		});
	} else if (entity == "release") {
		// get release metadata
		$.ajax({
			method: 'GET',
			url: 'https://musicbrainz.org/ws/2/release/' + mbid + '?inc=artists+labels+media+release-groups+url-rels',
			success: enterRelease,
			error: function(xml) {
				console.log("Release request failed");
			}
		});
	}

	// allow all formats and bitrates
	$('#toggle_formats').prop("checked", true).change();
	$('#toggle_bitrates').prop("checked", true).change();
	
	// if release, toggle allowed media elsewhere
	if (entity == "release-group") {
		$('#toggle_media').prop("checked", true).change();
	}
}

function enterReleaseGroup(xml) {
	// get metadata from XML
	var title = $(xml).find("title").text();
	var year = $(xml).find("first-release-date").text();
	if (year != "") {
		year = year.match("[0-9]{4}")[0];
	}
	var type = matchType(xml, $("#categories"));

	// enter metadata in form
	setArtists(xml);
	$('[name="title"]').val(title);	
	$('[name="year"]').val(year);	
	var dd_val = $('select option').filter(function () { return $(this).html() == type;}).val(); 
	$('#releasetype').val(dd_val);
}

function enterRelease(xml) {
	// get metadata from XML
	var title = $(xml).find("release > title").text();
	var year = $(xml).find("release date").text();
	if (year != "") {
		year = year.match("[0-9]{4}")[0];
	}
	var type = matchType(xml, $("#categories"));
	if($(xml).find("release status").text() == "Bootleg") {
		type = "Bootleg";
	}

	var label = $(xml).find("label name").text();
	var catalogNumber = $(xml).find("label-info catalog-number").text();

	// enter metadata in form
	setArtists(xml);
	$('[name="title"]').val(title);	
	$('[name="year"]').val(year);	
	var dd_val = $('select option').filter(function () { return $(this).html() == type;}).val(); 
	$('#releasetype').val(dd_val);

	$('[name="recordlabel"]').val(label);	
	$('[name="cataloguenumber"]').val(catalogNumber);	
	setMedium(xml, $("#media_tr"));

	setDescription(xml);
}

function listUrls(xml, type, intro) {
	var list = "";

	$(xml).find('[type="' + type + '"] target').each(function() {
		if (list == "") {
			list += "[b]" + intro + "[/b]\n";
		}

		url = $(this).text();
		if (url.indexOf("itunes.apple.com") != -1) {
			setCoverArt(url);
		}	
		list += "[*]" + url + "\n";
	});
	
	if (list != "") {	
		text += list;
	}
}

function matchType(xml, categoryDropdown) {
	// "Audiobook" matches to the "Audiobooks" category
	if($(xml).find("secondary-type").text().indexOf("Audiobook") != -1) {
		categoryDropdown.val("Audiobooks").change();	
	}

	var type = null;
	// try all secondary types
	$(xml).find("secondary-type").each(function() {
	switch ($(this).text()) {
		// types named the same
		case "Compilation":
		case "Soundtrack":
		case "Interview":
		case "Remix":
			type = $(this).text();
			return false;
		
		// types named slightly differently
		case "Live":
			type = "Live album";
			return false;
		case "DJ-mix":
			type = "DJ Mix";
			return false;
		case "Mixtape/Street":
			type = "Mixtape";
			return false;

		// "Soundtrack" has no equivalent
		}
	});

	// return if match found
	if (type != null) {
		return type;
	}

	// use primary type if no match on secondary type
	switch ($(xml).find("primary-type").text()) {
		case "Album":
		case "Single":
		case "EP":
			type = $(xml).find("primary-type").text();
			break;

		// no match for "Broadcast" or "Other"
	}

	// if no match, return null
	return type;
}

function setCoverArt(url) {
	$.ajax({
		type: "GET",
		url: url,
		success: function(data) {
			image = $(data).find("#left-stack img.artwork").attr("src-swap-high-dpi").replace("340x340", "1200x1200");
			$('[name="image"]').val(image);
		},
		error: function() { console.log("iTunes request failed"); }
	});
}

function reset() {
	$('select option:first-child').attr("selected", "selected").change();
	$('input[type="text"]:not(#mbid_box):not(#amount_box)').val("");
	$('textarea[name="description"]').val("");

	while ($("#artistfields input").length != 1) {
		$("#artistfields a.brackets:nth-of-type(2)").click();
	}

	$('input[type="checkbox"]').prop("checked", false).change();
}

function setArtists(xml) {
	var guest = false;
	$(xml).find("name-credit").each(function(index) {
		// do for all but the first
		if (index != 0) {
			$("#artistfields a.brackets:nth-of-type(1)").click();
		}

		var artist = $(this).find("artist name").text();
		$('[name="artists[]"]').eq(index).val(artist);	
		
		if ($(this).prev().attr("joinphrase") == " feat. ") {
			guest = true;
		}

		if (guest) {
			$('[name="importance[]"]').eq(index).val(2);	
		}
	});
}

// Examine the type of entity by performing AJAX requests
function setEntity(input, mbid) {
	if (input.indexOf("release-group") != -1) {
		entity = "release-group";
	} else if (input.indexOf("release") != -1) {
		entity = "release";
	} else {
		// if entity not stated in input
		$.ajax({
			method: 'GET',
			url: 'https://musicbrainz.org/ws/2/release-group/' + mbid,
			success: function() { entity = "release-group"; },
			error: function() { console.log("Entity is not release group"); },
			async: false
		});

		$.ajax({
			method: 'GET',
			url: 'https://musicbrainz.org/ws/2/release/' + mbid,
			success: function() { entity = "release"; },
			error: function() { console.log("Entity is not release"); },
			async: false
		});
	}
}

function setDescription(xml) {
	// get URL relationships
	if (entity == "release-group") {
		text = "Any release of this accepted. Thanks!\n\n";
	} else if (entity == "release") {
		text = "Only this specific release accepted. Thanks!\n\n";
	}
	text += "[b]MusicBrainz[/b]\n[*]" + url + "\n";

	listUrls(xml, "download for free", "Download for free");
	listUrls(xml, "purchase for download", "Purchase for download");
	listUrls(xml, "purchase for mail-order", "Purchase for mail-order");
	listUrls(xml, "amazon asin", "Amazon");

	text += "This request was automatically generated using the userscript [url=https://github.com/augustjanse/release-to-request]Release to request[/url]."

	$('textarea[name="description"]').val(text.trim());
}

function setMedium(xml, boxes) {
	$(xml).find("format").each(function() {
	switch ($(this).text()) {
		case "CD":
		case "CD-R":
		case "8cm CD":
		case "HDCD":
		case "Enhanced CD":
		case "SHM-CD":
			$(boxes).find("#media_0").prop("checked", true).change();
			break;

		case "Digital Media":
			$(boxes).find("#media_7").prop("checked", true).change();
			break;

		case "Vinyl":
		case '12" Vinyl':
		case '7" Vinyl':
		case '10" Vinyl':
			$(boxes).find("#media_2").prop("checked", true).change();
			break;

		case "Cassette":
			$(boxes).find("#media_6").prop("checked", true).change();
			break;

		case "DVD":
		case "DVD-Video":
		case "DVD-Audio":
			$(boxes).find("#media_1").prop("checked", true).change();
			break;

		case "SACD":
		case "Hybrid SACD":
			$(boxes).find("#media_4").prop("checked", true).change();
			break;

		case "Blu-ray":
			$(boxes).find("#media_8").prop("checked", true).change();
			break;
	}
	});
}
